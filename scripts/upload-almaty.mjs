// Upload the Almaty military history museum batch to Supabase.
//
//   ҚР Қарулы күштерінің әскери-тарихи мұражайы
//   (Military History Museum of the Armed Forces of the Republic of Kazakhstan)
//   Zenkov St 22/24, Medeu district, Almaty
//
// 9 frames, 8 subjects. Unlike Astana, THIS museum's placards are close enough
// to read, so most of this batch is a read rather than an inference. Each
// placard is trilingual — Kazakh, Russian, English — on a tilted steel plate.
//
// WHAT THE PLACARDS SAY
//   04  «БТР-40 / БТР-40 / BTR-40», bronetransportyor obraztsa 1950 goda,
//       SGMB 7.62mm, mass 5000 kg, crew 2 + 8 paratroopers, built 1950-1960.
//       Fully legible, no inference at all.
//   05  «БРДМ-2 / БРДМ-2 / BRDM-2». Legible.
//   09  «ЗИС-2 / ЗИС-2 / ZIS-2», caliber 57mm, fire range 8400 m, mass 1250 kg,
//       crew 5, 1941-1949. This is the placard for the RIGHT-hand gun.
//   02  Left placard title reads «Т-54». That settles the near tank, and it is
//       NOT the T-44 it was first taken for — the big cast turret with the rear
//       undercut and the 100mm tube without a fume extractor is an early T-54.
//
// WHAT HAD TO BE INFERRED
//   02  The far tank, number 376, keeps its placard edge-on and blown out at
//       every exposure I tried. Filed as T-55 on the commander's cupola, the IR
//       searchlight over the mantlet, and the fact that museums display the pair
//       together — but it is not read. Flagged.
//   03  BRDM-1: boat hull, belly wheels, and crucially NO turret, which is what
//       separates it from the BRDM-2 in frame 05.
//   06/07  BMP-1: short fat 73mm 2A28 in a one-man turret. The BMP-2 row added
//       with the Astana batch is the 30mm 2A42 in a two-man turret — different
//       vehicle, and this correctly pools onto the older BMP-1 row instead.
//   08  Large howitzer on a wheeled carriage. The spec column is legible —
//       caliber 203mm, fire range 18 000 m, crew 12, production from 1939 — and
//       those numbers are the B-4 family, but the title glyphs read as «БЛ-39»
//       which I cannot reconcile with any designation. Filed under a plainly
//       descriptive name and flagged rather than guessing B-4M.
//   09  The LEFT gun in that frame is a separate piece whose placard reads as
//       «М-33» with a spec column giving crew 8 and mass ~2300 kg. That is the
//       M-30 122mm howitzer's profile and the title is probably «М-30», but the
//       frame is filed on the ZiS-2 whose placard is unambiguous. Flagged so the
//       second gun is not silently lost.
//   01  Indoor case: Soviet colours with CCCP lettering and a row of ordnance
//       from a mortar bomb up to large-calibre cases. No single subject, so it
//       gets a descriptive row rather than being forced onto a vehicle.
//
// The ZiS-2 frame lands on the row created for the Baikonur gun. That is a
// genuine corroboration, not a convenience: Baikonur was called from a
// brake-less barrel on a ZiS-3 carriage with no placard anywhere, and this
// placard independently confirms what that profile is.
//
// COORDINATES are hand-set — pasted frames, no EXIF GPS. Point from the
// Nominatim result naming the museum:
//   43.2585, 76.9572  "ҚР Қарулы күштерінің әскери-тарихи мұражайы, 22;24,
//                      Зенков көшесі, Алтын шаршы, Медеу ауданы, Алматы"
// DATE is 2026-09-11.
//
// Run with:
//   node --env-file=.env.local scripts/upload-almaty.mjs --dry-run
//   node --env-file=.env.local scripts/upload-almaty.mjs

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/almaty war museum';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

const LOCATION = 'Military History Museum, Almaty';
const LAT = 43.2585;
const LNG = 76.9572;
const DATE = '2026-09-11';

const UNCERTAIN = {
  'almaty-02-c4cc6a27.jpg':
    'near tank read from its placard («Т-54»); the far tank 376 is filed as T-55 on cupola + IR searchlight only, its placard is unreadable',
  'almaty-08-57b58878.jpg':
    'placard specs legible (203mm, 18 000 m, crew 12, from 1939 — the B-4 family) but the title glyphs read «БЛ-39», which matches no designation I can confirm',
  'almaty-09-6e033270.jpg':
    'filed on the ZiS-2 whose placard is unambiguous; the second gun sharing the frame reads «М-33», probably M-30 122mm howitzer (crew 8, ~2300 kg), unconfirmed',
  'almaty-01-4ac8fc21.jpg':
    'indoor case of colours and mixed ordnance, no single subject — descriptive row, not a vehicle identification',
};

const GROUPS = [
  { name: 'T-54', type: 'tank', era: 'cold_war', nation: 'USSR',
    files: ['almaty-02-c4cc6a27.jpg'] },
  { name: 'BRDM-1', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['almaty-03-8b9c297e.jpg'] },
  { name: 'BTR-40', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['almaty-04-1d6a6933.jpg'] },
  { name: 'BRDM-2', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['almaty-05-c542a217.jpg'] },
  { name: 'BMP-1', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    files: ['almaty-07-618b1bb5.jpg', 'almaty-06-636a747d.jpg'] },
  { name: 'ZiS-2 57mm Anti-Tank Gun', type: 'artillery', era: 'ww2', nation: 'USSR',
    files: ['almaty-09-6e033270.jpg'] },
  { name: '203mm Heavy Howitzer', type: 'artillery', era: 'ww2', nation: 'USSR',
    files: ['almaty-08-57b58878.jpg'] },
  { name: 'Soviet Ordnance Display', type: 'other', era: 'other', nation: 'USSR',
    files: ['almaty-01-4ac8fc21.jpg'] },
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
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-almaty-'));

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
