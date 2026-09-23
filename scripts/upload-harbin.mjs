// Upload the Unit 731 Museum anti-aircraft guns to Supabase.
//
//   侵华日军第七三一部队罪证陈列馆 (Museum of Evidence of War Crimes by
//   Japanese Army Unit 731), Xinjiang St, Pingfang District, Harbin
//
// Two frames, one type. No museums.ts entry — the photographer asked for none,
// so this site will not show on the curated bucket list even though it is a
// museum. That is a deliberate exception to how Astana and Almaty were handled.
//
// IDENTIFICATION. Both guns are the 61-K 37mm automatic AA gun M1939, on the
// four-wheel ZU-7-pattern carriage with the circular firing platform, swing-up
// leaf-spring axles and screw-down jack pads. The green example in frame 02 is
// complete enough to read directly: clip-fed receiver with the feed tray on
// top, the twin-drum automatic sight above the cradle, elevation and traverse
// handwheels, gunner seats, folding step at the left rear, and a plain monobloc
// barrel whose muzzle is only slightly flared.
//   That muzzle is what rules out the other candidate. An S-60 57mm carries a
// large multi-slot muzzle brake and rides a visibly heavier carriage; there is
// no brake on either of these.
//   Frame 01 is the same gun type, stripped by corrosion — the sight assembly
// is gone and the barrel stands near-vertical — but the receiver, platform,
// handwheels and carriage all match frame 02.
//
// UNCERTAIN, and it matters for `nation`: China built the 61-K under licence as
// the Type 55, and the copy is externally indistinguishable from the Soviet
// original. Neither frame has a placard. Filed as USSR because the photographer
// described them as Soviet guns and the design is Soviet, but a Type 55 cannot
// be excluded from these two photographs.
//
// NOT filed on the existing "Soviet Anti-Aircraft Gun" row, which is a vague
// catch-all holding Chișinău pieces. A specific type deserves a specific row —
// and note the separate "Anti-Aircraft Gun" row is a French WW2 piece at Le MM
// Park, which is exactly the false friend to avoid here.
//
// COORDINATES hand-set from the Nominatim result naming the museum:
//   45.6070, 126.6332  "侵华日军第七三一部队罪证陈列馆, 新疆大街, 平房区,
//                       哈尔滨市, 黑龙江省, 150000, 中国"
// DATE is 2026-09-23.
//
// Run with:
//   node --env-file=.env.local scripts/upload-harbin.mjs --dry-run
//   node --env-file=.env.local scripts/upload-harbin.mjs

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/harbin unit 731';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

const LOCATION = 'Unit 731 Museum, Harbin';
const LAT = 45.6070;
const LNG = 126.6332;
const DATE = '2026-09-23';

const UNCERTAIN = {
  'harbin-01-20cd228d.jpg':
    'corroded example, sight assembly missing; type read from receiver, platform, handwheels and carriage matching frame 02',
  'harbin-02-efa725b9.jpg':
    'China built the 61-K under licence as the Type 55 and the copy is externally indistinguishable. No placard in either frame, so `nation: USSR` follows the design and the photographer, not a read.',
};

const GROUPS = [
  { name: '61-K 37mm Anti-Aircraft Gun', type: 'artillery', era: 'ww2', nation: 'USSR',
    files: ['harbin-02-efa725b9.jpg', 'harbin-01-20cd228d.jpg'] },
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
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-harbin-'));

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
