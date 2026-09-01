// Upload the Army Museum of Chișinău batch (1 Sep 2026) to Supabase.
//
// 13 photos of the outdoor Soviet-era garden at 47 Tighina St, Chișinău.
//
// None of these exhibits had a placard legible in frame, so names come from
// visual identification cross-checked against the museum's published collection
// (MiG-21 Fishbed, MiG-17 Fresco, S-75 Dvina, BTR-60PB, BTR-152, PT-76,
// T-34-85). Anything resting on inference is listed in UNCERTAIN below.
//
// Run with:
//   node --env-file=.env.local scripts/upload-chisinau.mjs --dry-run
//   node --env-file=.env.local scripts/upload-chisinau.mjs

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/chsiinau military museum';
const LOCATION = 'Army Museum, Chișinău';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

const UNCERTAIN = {
  'BRDM-2': 'four wheels, monocoque boat hull, no turret fitted; the museum also shows a 6x6 BTR-152, so the axle count is what separates them',
  'BTR-60PB': 'eight wheels and a boat hull; the museum publishes a BTR-60PB, which this matches',
  'PT-76': 'low flat amphibious hull with a muzzle-braked gun; matches the museum’s published PT-76',
  'Soviet Anti-Aircraft Gun': 'towed four-wheel carriage with a shield and long barrel — calibre not determinable from the frame, so this is deliberately generic rather than a guess at S-60 or KS-19',
  'MiG-17': 'plain circular nose intake with no shock cone, which is what separates it from the MiG-21 beside it',
  'MiG-21': 'red shock cone in the nose intake, tail number 29',
};

// Names deliberately NOT reused: the archive already has an "Anti-Aircraft Gun"
// row that is a French WW2 piece, so pooling this Soviet gun under that name
// would merge two unrelated exhibits.

const VEHICLES = [
  { name: 'BRDM-2', type: 'vehicle', era: 'cold_war', nation: 'USSR', files: ['IMG_2442'] },
  { name: 'T-34-85', type: 'tank', era: 'ww2', nation: 'USSR', files: ['IMG_2443'] },
  { name: 'BTR-60PB', type: 'vehicle', era: 'cold_war', nation: 'USSR', files: ['IMG_2444'] },
  { name: 'PT-76', type: 'tank', era: 'cold_war', nation: 'USSR', files: ['IMG_2445'] },
  { name: 'BM-13 Katyusha', type: 'vehicle', era: 'ww2', nation: 'USSR', files: ['IMG_2446'] },
  { name: 'Soviet Anti-Aircraft Gun', type: 'artillery', era: 'cold_war', nation: 'USSR', files: ['IMG_2447'] },
  { name: 'MiG-17', type: 'aircraft', era: 'cold_war', nation: 'USSR', files: ['IMG_2448', 'IMG_2449'] },
  { name: 'MiG-21', type: 'aircraft', era: 'cold_war', nation: 'USSR', files: ['IMG_2450', 'IMG_2453', 'IMG_2454', 'IMG_2452'] },
  { name: 'S-75 Dvina', type: 'other', era: 'cold_war', nation: 'USSR', files: ['IMG_2451'] },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

globalThis.WebSocket = WebSocket;
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const slugify = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
   .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function readExif(file) {
  try {
    const out = execFileSync('/usr/bin/mdls', [
      '-name', 'kMDItemContentCreationDate', '-name', 'kMDItemLatitude',
      '-name', 'kMDItemLongitude', file,
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

function toJpegBuffer(file, workDir) {
  const out = path.join(workDir, `${path.basename(file, path.extname(file))}.jpg`);
  execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', file, '--out', out], { stdio: 'ignore' });
  return readFileSync(out);
}

async function findOrCreateVehicle(v) {
  const { data: existing, error: selErr } = await supabase
    .from('vehicles').select('id').eq('name', v.name).maybeSingle();
  if (selErr) throw selErr;
  if (existing) return { id: existing.id, created: false };
  if (DRY) return { id: '(dry-run)', created: true };
  const { data, error } = await supabase
    .from('vehicles').insert({ name: v.name, type: v.type, era: v.era, nation: v.nation })
    .select('id').single();
  if (error) throw error;
  return { id: data.id, created: true };
}

let vehiclesMade = 0, photosMade = 0, skipped = 0, failed = 0;
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-chi-'));

for (const v of VEHICLES) {
  const flag = UNCERTAIN[v.name] ? '  [UNCERTAIN]' : '';
  console.log(`\n=== ${v.name} — ${v.files.length} photo(s) [${v.type}/${v.era}/${v.nation}]${flag} ===`);

  let vehicle;
  try {
    vehicle = await findOrCreateVehicle(v);
    if (vehicle.created) vehiclesMade += 1;
    else console.log(`  vehicle already exists (${vehicle.id}) — attaching photos to it`);
  } catch (e) {
    console.error(`  x vehicle failed: ${e.message}`);
    failed += v.files.length;
    continue;
  }

  const slug = slugify(v.name);

  for (const [i, stem] of v.files.entries()) {
    const src = path.join(SRC, `${stem}.HEIC`);
    if (!existsSync(src)) { console.error(`  x ${stem}: not found`); failed += 1; continue; }

    const lower = stem.toLowerCase();
    const storagePath = `uploads/${slug}/${lower}.jpg`;
    const thumbPath = `uploads/${slug}/${lower}-thumb.jpg`;

    try {
      const exif = readExif(src);
      const raw = toJpegBuffer(src, workDir);
      const pipeline = sharp(raw).rotate();
      const full = await pipeline.clone()
        .resize(FULL_MAX, FULL_MAX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      const thumb = await pipeline.clone()
        .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true }).toBuffer();
      const { data: px, info } = await pipeline.clone()
        .raw().ensureAlpha().resize(32, 32, { fit: 'inside' }).toBuffer({ resolveWithObject: true });
      const blurhash = encode(new Uint8ClampedArray(px), info.width, info.height, 4, 4);

      const row = {
        vehicle_id: vehicle.id, storage_path: storagePath, thumbnail_path: thumbPath,
        blurhash, width: full.info.width, height: full.info.height,
        location_taken: LOCATION, date_taken: exif.date_taken,
        lat: exif.lat, lng: exif.lng, sort_order: i,
      };

      if (DRY) {
        console.log(`  [dry] ${stem} -> ${storagePath} ${full.info.width}x${full.info.height} ` +
                    `date=${exif.date_taken} gps=${exif.lat?.toFixed(4)},${exif.lng?.toFixed(4)}`);
        photosMade += 1;
        continue;
      }

      const { data: dupe } = await supabase
        .from('photos').select('id').eq('storage_path', storagePath).maybeSingle();
      if (dupe) { console.log(`  - ${stem} already uploaded, skipping`); skipped += 1; continue; }

      for (const [p, buf] of [[storagePath, full.data], [thumbPath, thumb]]) {
        const { error } = await supabase.storage
          .from(BUCKET).upload(p, buf, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
      }
      const { error: insErr } = await supabase.from('photos').insert(row);
      if (insErr) throw insErr;
      console.log(`  + ${stem} -> ${storagePath} (${full.info.width}x${full.info.height})`);
      photosMade += 1;
    } catch (e) {
      console.error(`  x ${stem}: ${e.message ?? e}`);
      failed += 1;
    }
  }
}

rmSync(workDir, { recursive: true, force: true });
console.log(`\n${DRY ? 'DRY RUN — nothing written.' : 'Done.'} ` +
            `vehicles: ${vehiclesMade}, photos: ${photosMade}, skipped: ${skipped}, failed: ${failed}`);
console.log(`\n${Object.keys(UNCERTAIN).length} name(s) are inference, not placard-confirmed:`);
for (const [n, why] of Object.entries(UNCERTAIN)) console.log(`  ${n} — ${why}`);
