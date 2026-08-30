// Upload the Imperial War Museum London batch (30 Aug 2026) to Supabase.
//
// Unlike scripts/upload-local.mjs, which maps one FOLDER to one vehicle, this
// visit produced a single camera roll covering ~16 subjects, so the mapping is
// per-FILE instead. Everything else matches upload-local.mjs: HEIC is decoded
// with macOS `sips` (sharp has no HEIC decoder here) and EXIF date/GPS is read
// from the ORIGINAL via `mdls`, because sips drops it on conversion.
//
// location_taken deliberately contains "Imperial War Museum" so the museums
// page matches it against MUSEUMS[].match and flips the entry to visited.
//
// Run with:
//   node --env-file=.env.local scripts/upload-iwm-london.mjs --dry-run
//   node --env-file=.env.local scripts/upload-iwm-london.mjs
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
const SRC = '/Users/nikita/Downloads/New Folder With Items';
const LOCATION = 'Imperial War Museum, London';
const BUCKET = 'photos';
const FULL_MAX = 2400; // longest edge for the full-size render
const THUMB_MAX = 600;

// One entry per vehicle. `files` are stems of the .HEIC originals, in the order
// they should appear in the lightbox (lead shot first, not camera order).
const VEHICLES = [
  { name: 'BL 15-inch Naval Guns', type: 'artillery', era: 'ww1', nation: 'UK',
    files: ['IMG_2200', 'IMG_2236'] },
  { name: 'Harrier GR.9', type: 'aircraft', era: 'modern', nation: 'UK',
    files: ['IMG_2228', 'IMG_2201', 'IMG_2202', 'IMG_2227'] },
  { name: 'Supermarine Spitfire', type: 'aircraft', era: 'ww2', nation: 'UK',
    files: ['IMG_2203', 'IMG_2206'] },
  // IMG_2204 is the Ohka, not the V-1 — stubby wings, twin fins, no pulsejet.
  // Kept separate from the existing "Yokosuka D4Y Suisei + Ohka Model 11" row,
  // which is a combined display at a different museum.
  { name: 'Yokosuka MXY-7 Ohka', type: 'aircraft', era: 'ww2', nation: 'Japan',
    files: ['IMG_2204'] },
  { name: 'V-1 Flying Bomb', type: 'other', era: 'ww2', nation: 'Germany',
    files: ['IMG_2233'] },
  { name: 'V-2 Rocket', type: 'other', era: 'ww2', nation: 'Germany',
    files: ['IMG_2205'] },
  { name: 'T-34-85', type: 'tank', era: 'ww2', nation: 'USSR',
    files: ['IMG_2207', 'IMG_2208'] },
  { name: 'WW1 Field Gun', type: 'artillery', era: 'ww1', nation: 'UK',
    files: ['IMG_2209'] },
  { name: 'Mark V Tank', type: 'tank', era: 'ww1', nation: 'UK',
    files: ['IMG_2214', 'IMG_2211', 'IMG_2217', 'IMG_2215'] },
  { name: 'Avro Lancaster', type: 'aircraft', era: 'ww2', nation: 'UK',
    files: ['IMG_2218'] },
  { name: '8.8 cm Flak 36', type: 'artillery', era: 'ww2', nation: 'Germany',
    files: ['IMG_2219'] },
  { name: "Humber Super Snipe (Monty's Staff Car)", type: 'vehicle', era: 'ww2', nation: 'UK',
    files: ['IMG_2220'] },
  { name: 'M4 Sherman', type: 'tank', era: 'ww2', nation: 'USA',
    files: ['IMG_2222'] },
  { name: 'Mitsubishi A6M Zero', type: 'aircraft', era: 'ww2', nation: 'Japan',
    files: ['IMG_2223', 'IMG_2224'] },
  // IWM object 70000236: Ferret Mk 2 in UN white, Cyprus peacekeeping from 1981.
  // Matches the existing 'Ferret' row by name, so these photos attach to it and
  // the type/era/nation below are never applied. (That row is filed as ww2,
  // which is wrong for a 1952 design — fix it separately, not here.)
  { name: 'Ferret', type: 'vehicle', era: 'cold_war', nation: 'UK',
    files: ['IMG_2226'] },
  { name: 'Ordnance QF 25-pounder', type: 'artillery', era: 'ww2', nation: 'UK',
    files: ['IMG_2230'] },
  { name: 'Heavy Howitzer', type: 'artillery', era: 'ww1', nation: 'UK',
    files: ['IMG_2231'] },
  // Not a vehicle, but the gallery already files this kind of subject under
  // type 'other' (see the existing "Miscellaneous" rows), so it fits.
  { name: 'Small Arms', type: 'other', era: 'other', nation: 'UK',
    files: ['IMG_2221'] },
];

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

// The source folder is a live camera-roll dump that gets renamed in place —
// e.g. IMG_2219.HEIC became "flak 88.HEIC" and IMG_2211.HEIC became
// "IMG_2211some Mark WW1 tank?.HEIC" mid-review. Resolve each entry by exact
// name first, then by IMG_NNNN prefix, so a later rename does not silently
// drop a photo from the batch.
const DIR = readdirSync(SRC).filter((n) => /\.heic$/i.test(n));

// Four files were renamed past recognition mid-review. Each mapping below was
// confirmed by matching the file's EXIF capture time against the timestamp the
// original IMG_NNNN carried, not by trusting the new name.
const ALIASES = {
  IMG_2209: 'heavy artiellery.HEIC',          // 12:03:59
  IMG_2219: 'flak 88.HEIC',                   // 12:08:32
  IMG_2220: 'montys humber staff car.HEIC',   // 12:09:36
  IMG_2222: 'some sherman.HEIC',              // 12:09:58
};

function resolveSource(entry) {
  if (ALIASES[entry]) {
    if (!DIR.includes(ALIASES[entry])) {
      throw new Error(`alias "${ALIASES[entry]}" for ${entry} is no longer in ${SRC}`);
    }
    return ALIASES[entry];
  }

  const exact = DIR.filter((n) => n === `${entry}.HEIC` || n === entry);
  if (exact.length === 1) return exact[0];

  const prefixed = DIR.filter((n) => n.startsWith(entry));
  if (prefixed.length === 1) return prefixed[0];
  if (prefixed.length > 1) {
    throw new Error(`"${entry}" matches ${prefixed.length} files: ${prefixed.join(', ')}`);
  }
  throw new Error(`no file in ${SRC} matches "${entry}"`);
}

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

async function findOrCreateVehicle(v) {
  const { data: existing, error: selErr } = await supabase
    .from('vehicles').select('id').eq('name', v.name).maybeSingle();
  if (selErr) throw selErr;
  if (existing) return { id: existing.id, created: false };

  if (DRY) return { id: '(dry-run)', created: true };

  const { data, error } = await supabase
    .from('vehicles')
    .insert({ name: v.name, type: v.type, era: v.era, nation: v.nation })
    .select('id').single();
  if (error) throw error;
  return { id: data.id, created: true };
}

let vehiclesMade = 0, photosMade = 0, skipped = 0, failed = 0;
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-iwm-'));

for (const v of VEHICLES) {
  console.log(`\n=== ${v.name} — ${v.files.length} photo(s) [${v.type}/${v.era}/${v.nation}] ===`);

  let vehicle;
  try {
    vehicle = await findOrCreateVehicle(v);
    if (vehicle.created) vehiclesMade += 1;
    else console.log(`  vehicle already exists (${vehicle.id}) — attaching photos to it`);
  } catch (e) {
    console.error(`  ✗ vehicle failed: ${e.message}`);
    failed += v.files.length;
    continue;
  }

  const slug = slugify(v.name);

  for (const [i, stem] of v.files.entries()) {
    let src;
    try {
      src = path.join(SRC, resolveSource(stem));
    } catch (e) {
      console.error(`  ✗ ${stem}: ${e.message}`);
      failed += 1;
      continue;
    }

    // Storage path comes from the catalogue stem, never the on-disk filename,
    // so renaming a source file cannot create a duplicate upload.
    const lower = stem.toLowerCase();
    const storagePath = `uploads/${slug}/${lower}.jpg`;
    const thumbPath = `uploads/${slug}/${lower}-thumb.jpg`;

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
        location_taken: LOCATION,
        date_taken: exif.date_taken,
        lat: exif.lat,
        lng: exif.lng,
        sort_order: i,
      };

      if (DRY) {
        console.log(
          `  [dry] ${stem} -> ${storagePath} ` +
          `${full.info.width}x${full.info.height} ${(full.data.length / 1024 | 0)}KB ` +
          `date=${exif.date_taken} gps=${exif.lat?.toFixed(4)},${exif.lng?.toFixed(4)}`,
        );
        photosMade += 1;
        continue;
      }

      const { data: dupe } = await supabase
        .from('photos').select('id').eq('storage_path', storagePath).maybeSingle();
      if (dupe) {
        console.log(`  - ${stem} already uploaded, skipping`);
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

      console.log(`  ✓ ${path.basename(src)} -> ${storagePath} (${full.info.width}x${full.info.height})`);
      photosMade += 1;
    } catch (e) {
      console.error(`  ✗ ${stem}: ${e.message ?? e}`);
      failed += 1;
    }
  }
}

rmSync(workDir, { recursive: true, force: true });

console.log(
  `\n${DRY ? 'DRY RUN — nothing written.' : 'Done.'} ` +
  `vehicles: ${vehiclesMade}, photos: ${photosMade}, skipped: ${skipped}, failed: ${failed}`,
);
