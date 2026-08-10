// Upload local photo folders to Supabase Storage + insert vehicle/photo rows.
//
// Each folder maps to one vehicle; every image inside becomes a photo row.
// HEIC is converted to JPEG via macOS `sips` (sharp has no HEIC decoder here),
// and EXIF date/GPS is read from the ORIGINAL file via `mdls` — sips drops it.
//
// Run with:
//   node --env-file=.env.local scripts/upload-local.mjs --dry-run
//   node --env-file=.env.local scripts/upload-local.mjs
//
// Safe to re-run: vehicles are matched by name, photos by storage path.

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const ROOT = '/Users/nikita/Downloads';
const BUCKET = 'photos';
const FULL_MAX = 2400; // longest edge for the full-size render
const THUMB_MAX = 600;

const FOLDERS = [
  {
    dir: 'Submarine Becuna',
    name: 'USS Becuna (SS-319)',
    type: 'submarine',
    era: 'ww2',
    nation: 'USA',
    location: 'Independence Seaport Museum, Philadelphia, PA',
  },
  {
    dir: 'USS Olympia (C-6)',
    name: 'USS Olympia (C-6)',
    type: 'ship',
    era: 'other',
    nation: 'USA',
    location: 'Independence Seaport Museum, Philadelphia, PA',
  },
  {
    dir: 'USS Pampanito SF',
    name: 'USS Pampanito (SS-383)',
    type: 'submarine',
    era: 'ww2',
    nation: 'USA',
    location: "Fisherman's Wharf, San Francisco, CA",
  },
  {
    dir: 'SF Battery Cannon',
    name: 'Battery Chamberlin 6-inch Gun',
    type: 'artillery',
    era: 'other',
    nation: 'USA',
    location: 'Baker Beach, Presidio of San Francisco, CA',
  },
  {
    dir: 'USS New Jersey',
    name: 'USS New Jersey (BB-62)',
    type: 'ship',
    era: 'ww2',
    nation: 'USA',
    location: 'Battleship New Jersey Museum, Camden, NJ',
  },
];

const IMAGE_RE = /\.(heic|jpe?g|png)$/i;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

globalThis.WebSocket = WebSocket;
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// EXIF via Spotlight metadata on the original file (survives HEIC).
function readExif(file) {
  try {
    const out = execFileSync('/usr/bin/mdls', [
      '-name', 'kMDItemContentCreationDate',
      '-name', 'kMDItemLatitude',
      '-name', 'kMDItemLongitude',
      file,
    ]).toString();
    const grab = (k) => {
      const m = out.match(new RegExp(`${k}\\s*=\\s*(.+)`));
      if (!m) return null;
      const v = m[1].trim();
      return v === '(null)' ? null : v;
    };
    const rawDate = grab('kMDItemContentCreationDate');
    const lat = grab('kMDItemLatitude');
    const lng = grab('kMDItemLongitude');
    return {
      date_taken: rawDate ? rawDate.slice(0, 10) : null,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
    };
  } catch {
    return { date_taken: null, lat: null, lng: null };
  }
}

// HEIC has no sharp decoder here; sips is built into macOS.
function toJpegBuffer(file, workDir) {
  if (/\.heic$/i.test(file)) {
    const out = path.join(workDir, `${path.basename(file, path.extname(file))}.jpg`);
    execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', file, '--out', out], {
      stdio: 'ignore',
    });
    return readFileSync(out);
  }
  return readFileSync(file);
}

async function findOrCreateVehicle(f) {
  const { data: existing, error: selErr } = await supabase
    .from('vehicles').select('id').eq('name', f.name).maybeSingle();
  if (selErr) throw selErr;
  if (existing) return { id: existing.id, created: false };

  if (DRY) return { id: '(dry-run)', created: true };

  const { data, error } = await supabase
    .from('vehicles')
    .insert({ name: f.name, type: f.type, era: f.era, nation: f.nation })
    .select('id').single();
  if (error) throw error;
  return { id: data.id, created: true };
}

let vehiclesMade = 0, photosMade = 0, skipped = 0, failed = 0;
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-upload-'));

for (const f of FOLDERS) {
  const dir = path.join(ROOT, f.dir);
  const files = readdirSync(dir).filter((n) => IMAGE_RE.test(n)).sort();

  console.log(`\n=== ${f.name} — ${files.length} image(s) [${f.type}/${f.era}] ===`);

  let vehicle;
  try {
    vehicle = await findOrCreateVehicle(f);
    if (vehicle.created) vehiclesMade += 1;
    else console.log(`  vehicle already exists (${vehicle.id})`);
  } catch (e) {
    console.error(`  ✗ vehicle failed: ${e.message}`);
    failed += files.length;
    continue;
  }

  const slug = slugify(f.name);

  for (const [i, base] of files.entries()) {
    const src = path.join(dir, base);
    const stem = path.basename(base, path.extname(base)).toLowerCase();
    const storagePath = `uploads/${slug}/${stem}.jpg`;
    const thumbPath = `uploads/${slug}/${stem}-thumb.jpg`;

    try {
      const exif = readExif(src);
      const raw = toJpegBuffer(src, workDir);

      // .rotate() with no args applies the EXIF orientation, then strips it,
      // so the stored pixels are already upright.
      const pipeline = sharp(raw).rotate();
      const full = await pipeline
        .clone().resize(FULL_MAX, FULL_MAX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      const thumb = await pipeline
        .clone().resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true }).toBuffer();

      const { data: px, info } = await pipeline
        .clone().raw().ensureAlpha().resize(32, 32, { fit: 'inside' })
        .toBuffer({ resolveWithObject: true });
      const blurhash = encode(new Uint8ClampedArray(px), info.width, info.height, 4, 4);

      const row = {
        vehicle_id: vehicle.id,
        storage_path: storagePath,
        thumbnail_path: thumbPath,
        blurhash,
        width: full.info.width,
        height: full.info.height,
        location_taken: f.location,
        date_taken: exif.date_taken,
        lat: exif.lat,
        lng: exif.lng,
        sort_order: i,
      };

      if (DRY) {
        console.log(
          `  [dry] ${base} -> ${storagePath} ` +
          `${full.info.width}x${full.info.height} ${(full.data.length / 1024 | 0)}KB ` +
          `date=${exif.date_taken} gps=${exif.lat?.toFixed(4)},${exif.lng?.toFixed(4)}`,
        );
        photosMade += 1;
        continue;
      }

      const { data: dupe } = await supabase
        .from('photos').select('id').eq('storage_path', storagePath).maybeSingle();
      if (dupe) {
        console.log(`  - ${base} already uploaded, skipping`);
        skipped += 1;
        continue;
      }

      for (const [p, buf] of [[storagePath, full.data], [thumbPath, thumb]]) {
        const { error } = await supabase.storage
          .from(BUCKET).upload(p, buf, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
      }

      const { error: insErr } = await supabase.from('photos').insert(row);
      if (insErr) throw insErr;

      console.log(`  ✓ ${base} -> ${storagePath} (${full.info.width}x${full.info.height})`);
      photosMade += 1;
    } catch (e) {
      console.error(`  ✗ ${base}: ${e.message ?? e}`);
      failed += 1;
    }
  }
}

rmSync(workDir, { recursive: true, force: true });

console.log(
  `\n${DRY ? 'DRY RUN — nothing written.' : 'Done.'} ` +
  `vehicles: ${vehiclesMade}, photos: ${photosMade}, skipped: ${skipped}, failed: ${failed}`,
);
