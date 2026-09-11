// Upload the Almaty Central Park military hardware display to Supabase.
//
//   Орталық Демалыс және Мәдениет Саябағы (Central Park of Culture and
//   Recreation), Medeu district, Almaty — the open display beside the zoo.
//
// A DIFFERENT SITE from the Zenkov St museum in upload-almaty.mjs, and kept
// separate deliberately. Two independent signals say so: the photographer
// placed it themselves ("a park in Almaty near Lenin and zoo and kinoplexx"),
// and the signage is a different system entirely — blue enamel plates in
// Kazakh and Russian only, where the museum uses white steel plates in Kazakh,
// Russian and English. Merging the two would have put one museum's visited
// marker on a park 2 km away.
//
// IDENTIFICATION. The blue plates are large and shot close, so this whole
// batch is read, not inferred:
//   «Т - 55 ТАНКІ / ТАНК Т - 55»              — crew 4, 36.5 t, 9000mm long
//   «МИ-8 ТІКҰШАҒЫ / ВЕРТОЛЁТ МИ-8»           — tactical number 85
//   «МИГ – 21 / МИГ – 21»                     — red nose cone
//   «БТР – 70 сауытты тасымалдаушы»           — 2x ZMZ-4905, 753.5cm long
//   «БТР – 60 БП / Бронетранспортёр БТР-60БП» — 8x8, 9.5-9.9 t, 1960-1963
//   «ГАЗ - 66»                                — 2000 kg payload, 4x4
// The photographer guessed "BTR 70 and 60 I think" and both plates confirm it.
// Frame 08 has the two BTRs side by side with both plates in shot, which is
// the cleanest possible separation of a pair that is otherwise easy to confuse.
//
// NOT read, and flagged:
//   12  BM-13 Katyusha with no plate in frame. Filed on the existing BM-13
//       row alongside the museum's example, but note the chassis differs — the
//       museum's plate says БМ-13НМ (ZIL-157) while this one sits on an
//       earlier ZIS-151-type cab with separate wing fenders. Same weapon
//       system, one gallery card, variant difference recorded here.
//   13  Two towed guns on a plinth, no plate in frame.
//
// COORDINATES hand-set from the Nominatim result naming the park:
//   43.2616, 76.9693  "Орталық Демалыс және Мәдениет Саябағы, Медеу ауданы,
//                      Алматы, Қазақстан"
// The zoo the photographer used as a landmark sits 600 m northeast at
// 43.2639/76.9767, which is consistent and not close enough to collide with
// the museum's 43.2585/76.9572.
// DATE is 2026-09-11.
//
// Run with:
//   node --env-file=.env.local scripts/upload-almaty-park.mjs --dry-run
//   node --env-file=.env.local scripts/upload-almaty-park.mjs

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/almaty park';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

const LOCATION = 'Central Park, Almaty';
const LAT = 43.2616;
const LNG = 76.9693;
const DATE = '2026-09-11';

const UNCERTAIN = {
  'park-12-7b0db351.jpg':
    'Katyusha with no plate in frame. Filed on the shared BM-13 row; chassis is an earlier ZIS-151-type cab, not the ZIL-157 the museum plate (БМ-13НМ) names.',
  'park-13-90b5af18.jpg':
    'two towed guns on a plinth, no plate in frame — descriptive row, no type called',
};

const GROUPS = [
  { name: 'T-55', type: 'tank', era: 'cold_war', nation: 'USSR',
    files: ['park-02-ded563d5.jpg', 'park-04-6aeca67f.jpg', 'park-01-63ced540.jpg'] },
  { name: 'Mi-8', type: 'aircraft', era: 'cold_war', nation: 'USSR',
    files: ['park-05-b8b5767e.jpg', 'park-03-0497496a.jpg'] },
  { name: 'MiG-21', type: 'aircraft', era: 'cold_war', nation: 'USSR',
    files: ['park-06-bb47cfdc.jpg', 'park-07-82b39d98.jpg'] },
  { name: 'BTR-70', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['park-09-3262aa08.jpg', 'park-08-4f5d69e7.jpg'] },
  { name: 'BTR-60PB', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['park-10-3c3acd90.jpg'] },
  { name: 'GAZ-66', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['park-11-585a0529.jpg'] },
  { name: 'BM-13 Katyusha', type: 'vehicle', era: 'ww2', nation: 'USSR',
    files: ['park-12-7b0db351.jpg'] },
  { name: 'Soviet Towed Artillery', type: 'artillery', era: 'cold_war', nation: 'USSR',
    files: ['park-13-90b5af18.jpg'] },
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
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-almatypark-'));

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
