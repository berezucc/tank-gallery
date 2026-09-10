// Upload the Kyzylorda Victory Park memorials to Supabase.
//
//   Victory Park (Жеңіс паркі / парк Победы), Kyzylorda, Kazakhstan
//
// Three frames, two subjects. Not a museum — open memorials in a city park, so
// there are no placards in any frame and nothing was cropped out.
//
// IDENTIFICATION
//   D-1 152mm Howitzer (frame 01). A double-baffle muzzle brake with two large
//   oval side ports, sitting on an unmistakable M-30-pattern split-trail
//   carriage: two pneumatic road wheels, box shield with the cut-off top
//   corner, recuperator slab over the barrel. That combination is the D-1 —
//   the 152mm barrel put on the M-30 carriage in 1943. The plain M-30 122mm is
//   ruled out because it has no muzzle brake at all; the D-20 is ruled out on
//   the carriage, which carries a firing jack under the axle and a lower, wider
//   shield; the A-19 and ML-20 are both much longer-barrelled on heavier
//   carriages. Behind it the wall reads "ЕР ЕСІМІ ЕЛ ЕСІНДЕ" — the hero's name
//   is in the people's memory.
//
//   BTR-70 (frames 02, 03). Eight wheels, BPU-1 turret with the 14.5mm KPVT,
//   teardrop firing ports along the upper hull. The discriminator is between
//   the 2nd and 3rd axles: there is a hinged hatch set entirely in the LOWER
//   hull, below the yellow line, with two hinges on its forward edge. That is
//   the BTR-70's side hatch, the half that folds down as a step. A BTR-80 has
//   one large two-part door whose upper half breaks the upper hull, and the
//   upper hull here is unbroken except for firing ports. A BTR-60PB has no side
//   hatch at all. So this is neither the existing BTR-60PB row nor the BTR-80
//   row added with the Astana batch — it needs its own.
//
// COORDINATES are set by hand and are the weak part of this batch. These
// arrived pasted into a chat, so there is no EXIF GPS, and Nominatim has no
// "Victory Park" inside Kyzylorda city: both name matches sit 200+ km away in
// other districts of Kyzylorda oblast (Kazaly and Karmakshy) and were rejected
// rather than accepted, which is exactly the collision the Ontario sites hit.
// The anchor used instead is the Nominatim result for the WWII eternal flame
// in the city itself:
//   44.8486, 65.4917  "вечный огонь, Толыбекова улица, Қызылорда,
//                      Қызылорда облысы, 120000, Қазақстан"
// All three frames get that one point. See UNCERTAIN below — the BTR is
// visibly not on the memorial plaza and is probably ~160 m southwest at the
// "Воинам Афганцам" memorial (44.8473, 65.4908), a standard pairing for a
// BTR-70, but that attribution is inference and has not been confirmed.
//
// DATE is 2026-09-08, from the photographer being there.
//
// Run with:
//   node --env-file=.env.local scripts/upload-kyzylorda.mjs --dry-run
//   node --env-file=.env.local scripts/upload-kyzylorda.mjs

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/kyzylorda pobeda park';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

const LOCATION = 'Victory Park, Kyzylorda';
const LAT = 44.8486;
const LNG = 65.4917;
const DATE = '2026-09-08';

const UNCERTAIN = {
  'kyzylorda-01-912d4472.jpg':
    'D-1 152mm read from the double-baffle brake on an M-30 carriage; no placard in frame. M-30 and D-20 ruled out, but unread.',
  'kyzylorda-02-299db157.jpg':
    'coordinates: BTR is not on the memorial plaza; probably ~160m SW at the Воинам Афганцам memorial (44.8473, 65.4908), unconfirmed',
  'kyzylorda-03-32fcf6e7.jpg':
    'coordinates: same as 02 — filed on the eternal-flame anchor, actual plinth not pinned',
};

const GROUPS = [
  { name: 'D-1 152mm Howitzer', type: 'artillery', era: 'ww2', nation: 'USSR',
    files: ['kyzylorda-01-912d4472.jpg'] },
  { name: 'BTR-70', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['kyzylorda-02-299db157.jpg', 'kyzylorda-03-32fcf6e7.jpg'] },
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

// Already-JPEG sources are read straight through; sips is only needed to decode
// HEIC, and round-tripping a JPEG through it would re-compress for nothing.
function toJpegBuffer(file, workDir) {
  if (/\.jpe?g$/i.test(file)) return readFileSync(file);
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
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-kyzylorda-'));

for (const g of GROUPS) {
  console.log(`\n=== ${g.name} — ${g.files.length} photo(s) [${g.type}/${g.era}/${g.nation}] ===`);

  let vehicle;
  try {
    vehicle = await findOrCreateVehicle(g);
    if (vehicle.created) { vehiclesMade += 1; console.log('  new vehicle row'); }
    else console.log(`  vehicle already exists (${vehicle.id}) — attaching photos to it`);
  } catch (e) {
    console.error(`  x vehicle failed: ${e.message}`);
    failed += g.files.length;
    continue;
  }

  const slug = slugify(g.name);

  for (const [i, fname] of g.files.entries()) {
    const src = path.join(SRC, fname);
    if (!existsSync(src)) { console.error(`  x ${fname}: not found`); failed += 1; continue; }

    const stem = path.basename(fname, path.extname(fname)).toLowerCase();
    const storagePath = `uploads/${slug}/${stem}.jpg`;
    const thumbPath = `uploads/${slug}/${stem}-thumb.jpg`;

    try {
      const raw = toJpegBuffer(src, workDir);
      // These three all carry orientation=1, but .rotate() stays in the pipeline
      // so a later re-run with sideways frames still lands upright.
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
        location_taken: LOCATION, date_taken: DATE,
        lat: LAT, lng: LNG, sort_order: i,
      };

      if (DRY) {
        console.log(`  [dry] ${fname} -> ${storagePath} ${full.info.width}x${full.info.height}` +
                    (UNCERTAIN[fname] ? '  [UNCERTAIN]' : ''));
        photosMade += 1;
        continue;
      }

      const { data: dupe } = await supabase
        .from('photos').select('id').eq('storage_path', storagePath).maybeSingle();
      if (dupe) { console.log(`  - ${fname} already uploaded, skipping`); skipped += 1; continue; }

      for (const [p, buf] of [[storagePath, full.data], [thumbPath, thumb]]) {
        const { error } = await supabase.storage
          .from(BUCKET).upload(p, buf, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
      }
      const { error: insErr } = await supabase.from('photos').insert(row);
      if (insErr) throw insErr;
      console.log(`  + ${fname} -> ${storagePath} (${full.info.width}x${full.info.height})` +
                  (UNCERTAIN[fname] ? '  [UNCERTAIN]' : ''));
      photosMade += 1;
    } catch (e) {
      console.error(`  x ${fname}: ${e.message ?? e}`);
      failed += 1;
    }
  }
}

rmSync(workDir, { recursive: true, force: true });

console.log(`\n${DRY ? 'DRY RUN — nothing written.' : 'Done.'} ` +
            `vehicles: ${vehiclesMade}, photos: ${photosMade}, skipped: ${skipped}, failed: ${failed}`);

console.log('\nUNCERTAIN — check these before trusting the gallery card:');
for (const [f, why] of Object.entries(UNCERTAIN)) console.log(`  ${f}\n      ${why}`);
