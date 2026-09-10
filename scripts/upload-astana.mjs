// Upload the Astana open-air military park to Supabase.
//
//   State Military-Historical Museum (Мемлекеттік әскери-тарихи музей),
//   Alexander Baraev St, Baikonyr district, Astana, Kazakhstan
//
// 35 photos plus one poster frame pulled from an 8.3s clip. Eleven vehicles.
//
// LOCATION. The white dome under green scaffolding with a Russian tricolour
// behind the BTR and BMP frames is the Russian embassy, which stands on Baraev
// St beside the museum; the Allur/Geely and Shaurma Food towers behind the
// artillery line are Kazakh. OSM has the site as two overlapping museum ways
// (240391776 "Мемлекеттік әскери-тарихи музей", 1239171353 "Тарихи-Әскери
// Мұражай") with a T-34-85 tagged at 51.155413/71.432347 — a tank that appears
// in none of these frames, so there is more park here than got photographed.
//
// IDENTIFICATION. Every placard in the batch is in frame but shot from too far
// away to read: cropped at native resolution the largest resolves to three
// column headings and no legible glyphs. So each frame was identified from the
// vehicle and cross-checked against the museum's published collection, which
// names a T-72 and a Shilka explicitly.
//
//   L-29        T-tail with the stabiliser atop the fin, straight wing, wing-root
//               intakes (red covers), tandem stepped canopies, red nose, "03".
//               Filed on the existing L-29 row, whose `nation` reads USSR — the
//               Delfín is Czechoslovak, but that is a pre-existing field on a
//               shared row and not this batch's to rewrite.
//   S-125 Neva  Four V-601 rounds on one rotating 5P73 launcher. NOT the
//               existing "SAM-2" row: that is the S-75, a single-rail system.
//               This is the SA-3, a different launcher and a different missile.
//   BTR-80      8x8 with the single large two-part side door between the 2nd and
//               3rd axles. A BTR-70 has small low hatches there instead. Both
//               BTR frames are the same vehicle from front and left.
//   BMP-2       Long thin 30mm 2A42 in a two-man turret. The existing BMP-1 row
//               is the 73mm 2A28 in a one-man turret — a different vehicle, so
//               this gets its own row.
//   T-72        Kontakt-1 ERA in rows on the turret front and glacis, NSVT on the
//               cupola. At least two distinct hulls appear across these frames
//               (one with ERA, one without) and a third non-ERA MBT sits in the
//               background of 13 and 05; none of the three is isolated well
//               enough to separate, and all read as T-72 family.
//   ZSU-23-4    Quad 23mm on the GM-575 chassis. The video settles it: frame 0
//               catches two of the four barrels above the hull port the hand is
//               opening, and those hull ports match frame 19's superstructure.
//   BM-21 Grad  40-tube launcher on a Ural chassis.
//   2S1         Seven road wheels and a boat-shaped amphibious hull.
//   2S3         Six road wheels, much larger boxy rear turret, 152mm. Sits in
//               front of the 2S1 in frame 22, which is what separates the pair.
//   MiG-29      Twin canted tails, LERX, twin nozzles, tactical number 01. The
//               plaza frames and the park frames are the same airframe: 29 has
//               a museum artillery piece at the frame edge.
//
// UNCERTAIN — printed again at the end of every run:
//   19  Boxy tracked superstructure from the rear-left. Read as the ZSU-23-4
//       from behind on matching hull ports, paint and proportions, but no
//       barrel is visible in the frame and the call is inference, not a read.
//   24  A line of five towed pieces receding; no single subject.
//   25  Towed gun, long barrel under a canvas cover, multi-slot muzzle brake,
//       split trail. M-46 130mm is the best fit; D-20 and 2A36 are not excluded.
//   24 and 25 share a deliberately plain "Soviet Towed Artillery" row rather
//   than the existing generic "Artillery" row, which would pool them with
//   unrelated guns from other museums.
//
// COORDINATES are set by hand: these arrived pasted into a chat, which strips
// every EXIF tag but orientation, so there is no per-shot GPS. Point taken from
// the Nominatim result whose display_name names the museum:
//   51.1554, 71.4315  "Тарихи-Әскери Мұражай, Александр Бараев көшесі,
//                      Байқоңыр ауданы, Астана, 010000, Қазақстан"
// DATE is 2026-09-07, the day the photographer was standing there.
//
// ORIENTATION is mixed in this batch — some frames carry orientation=6 and some
// orientation=1 — so .rotate() is doing real work on only some of them. The
// poster frame comes out of ffmpeg already upright with no tag.
//
// Run with:
//   node --env-file=.env.local scripts/upload-astana.mjs --dry-run
//   node --env-file=.env.local scripts/upload-astana.mjs

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/astana military museum';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

const LOCATION = 'State Military-Historical Museum, Astana';
const LAT = 51.1554;
const LNG = 71.4315;
const DATE = '2026-09-07';

// Frames flagged for the operator; keyed by file, printed at the end of a run.
const UNCERTAIN = {
  'astana-19-2bc5d200.jpg':
    'rear-left of a boxy tracked superstructure; read as ZSU-23-4 from hull ports and paint, no barrel in frame',
  'astana-24-05d26aab.jpg':
    'line of five towed pieces receding, no single subject',
  'astana-25-44face1f.jpg':
    'towed gun, long barrel + multi-slot muzzle brake; M-46 130mm best fit, D-20 / 2A36 not excluded',
};

const GROUPS = [
  { name: 'L-29', type: 'aircraft', era: 'cold_war', nation: 'USSR',
    files: ['astana-01-da7e55cf.jpg'] },
  { name: 'S-125 Neva', type: 'other', era: 'cold_war', nation: 'USSR',
    files: ['astana-02-2f93c7d8.jpg'] },
  { name: 'BTR-80', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['astana-03-3ad41b6c.jpg', 'astana-04-fee42d8d.jpg'] },
  { name: 'BMP-2', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['astana-06-7d733761.jpg', 'astana-07-e0ebdcbe.jpg',
            'astana-09-4096a0b5.jpg', 'astana-05-23754243.jpg'] },
  { name: 'T-72', type: 'tank', era: 'cold_war', nation: 'USSR',
    files: ['astana-14-1169d0a0.jpg', 'astana-13-64a3f47d.jpg',
            'astana-11-edc3774e.jpg', 'astana-10-abac7d70.jpg',
            'astana-08-4e838896.jpg'] },
  { name: 'ZSU-23-4 Shilka', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['astana-15-16ee7909.jpg', 'astana-19-2bc5d200.jpg',
            'astana-36-video-poster.jpg', 'astana-12-1b2df098.jpg'] },
  { name: 'BM-21 Grad', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['astana-18-6e843ac6.jpg', 'astana-17-58ab9509.jpg',
            'astana-16-58a277dc.jpg'] },
  { name: '2S1 Gvozdika', type: 'tank', era: 'cold_war', nation: 'USSR',
    files: ['astana-20-f9b3d973.jpg', 'astana-21-e4381815.jpg'] },
  { name: '2S3 Akatsiya', type: 'tank', era: 'cold_war', nation: 'USSR',
    files: ['astana-23-abf8d929.jpg', 'astana-22-7d622b30.jpg'] },
  { name: 'Soviet Towed Artillery', type: 'artillery', era: 'cold_war', nation: 'USSR',
    files: ['astana-25-44face1f.jpg', 'astana-24-05d26aab.jpg'] },
  { name: 'MiG-29', type: 'aircraft', era: 'cold_war', nation: 'USSR',
    files: ['astana-35-a0864d64.jpg', 'astana-29-1fe26693.jpg',
            'astana-30-d000d368.jpg', 'astana-31-5b269561.jpg',
            'astana-34-93a83b46.jpg', 'astana-32-67fe9b0d.jpg',
            'astana-33-b85af15a.jpg', 'astana-26-6ba5f2fa.jpg',
            'astana-27-e6f44fa6.jpg', 'astana-28-a3870a82.jpg'] },
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
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-astana-'));

for (const g of GROUPS) {
  console.log(`\n=== ${g.name} — ${g.files.length} photo(s) [${g.type}/${g.era}/${g.nation}] ===`);

  let vehicle;
  try {
    vehicle = await findOrCreateVehicle(g);
    if (vehicle.created) { vehiclesMade += 1; console.log(`  new vehicle row`); }
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
      // Mixed orientation in this batch (some 6, some 1). .rotate() bakes the
      // tag in either way, so nothing lands sideways.
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

console.log('\nThe 8.3s clip itself is NOT uploaded — the photos table models stills only.' +
            '\nOnly its frame 0 went up, as astana-36-video-poster.jpg on the ZSU-23-4 row.' +
            `\nThe .mov stays at ${SRC}/astana-video-140219a3.mov`);
