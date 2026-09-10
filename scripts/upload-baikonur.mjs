// Upload the Baikonur Victory Park anti-tank gun to Supabase.
//
//   ZiS-2 57mm anti-tank gun — Victory Park, Baikonur, Kazakhstan
//
// One frame. Not a museum: an open memorial park, no placard anywhere in shot.
//
// IDENTIFICATION. Long, slender monobloc barrel with NO muzzle brake — the
// muzzle is a plain white-painted collar on a smooth tube, no baffles and no
// side ports, confirmed on a 5x native-resolution crop. Split-trail carriage
// with pneumatic road wheels, trails closed for travel, tall shield with the
// angled top edge and wheel cut-outs, recoil cylinders stacked above the tube,
// two white stars painted on the shield.
//   The ZiS-2 and the ZiS-3 share that carriage and that shield, so the barrel
// is the whole discriminator: a ZiS-3 76mm always carries a prominent
// double-baffle muzzle brake, and this tube has none while being distinctly
// longer and thinner. Hence ZiS-2. See UNCERTAIN — a ZiS-3 whose brake was
// unbolted is a real thing on memorial pieces and cannot be excluded from one
// frame without a placard.
//   The 45mm M-42 is ruled out on shield size and barrel length; the BS-3
// 100mm and D-48 85mm both carry muzzle brakes.
//
// LOCATION. The photographer's own label was "Baikonur victory park I think",
// and they later confirmed it applies to this frame only — the D-1 and BTR-70
// stay filed at Kyzylorda. OSM has no "Victory Park" in Baikonur, so the point
// is the city's WWII eternal flame, the anchor such a park is built around:
//   45.6153, 63.3218  "Мәңгілік От, улица Ленина, Байқоңыр Қ.Ә.,
//                      Қызылорда облысы, 468320, Қазақстан"
// Do NOT fall back to a "Victory Park" name search here: every Nominatim match
// for that name in Kyzylorda oblast lands 200+ km away in the Kazaly and
// Karmakshy districts, which is the same collision the Kyzylorda batch hit.
//
// COORDINATES are hand-set because the frame arrived pasted into a chat, which
// strips every EXIF tag but orientation. DATE is 2026-09-10.
//
// Run with:
//   node --env-file=.env.local scripts/upload-baikonur.mjs --dry-run
//   node --env-file=.env.local scripts/upload-baikonur.mjs

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/baikonur victory park';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

const LOCATION = 'Victory Park, Baikonur';
const LAT = 45.6153;
const LNG = 63.3218;
const DATE = '2026-09-10';

const UNCERTAIN = {
  'baikonur-01-5a699d79.jpg':
    'ZiS-2 read from a brake-less barrel on the shared ZiS-3 carriage; a ZiS-3 with its muzzle brake removed cannot be excluded from one frame. Also: no OSM "Victory Park" in Baikonur, so the point is the city eternal flame.',
};

const GROUPS = [
  { name: 'ZiS-2 57mm Anti-Tank Gun', type: 'artillery', era: 'ww2', nation: 'USSR',
    files: ['baikonur-01-5a699d79.jpg'] },
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
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-baikonur-'));

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

console.log('\nUNCERTAIN — check this before trusting the gallery card:');
for (const [f, why] of Object.entries(UNCERTAIN)) console.log(`  ${f}\n      ${why}`);
