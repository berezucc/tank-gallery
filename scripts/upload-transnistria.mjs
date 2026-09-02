// Upload the two Transnistrian roadside monuments to Supabase.
//
//   BMP-1  — Мемориал Памяти и Скорби, Bender (Bendery)
//   T-34-85 — Мемориал Славы, Tiraspol
//
// Neither is a museum: both are open memorials beside a public road, so there
// is no placard to read and nothing was cropped out of the frame.
//
// IDENTIFICATION
//   Bender: hull markings read "ПМР", six road wheels, pointed boat bow, low
//   turret. The vehicle is the restored BMP-1P whose six-man crew died at the
//   police-station battle on 22 June 1992; the memorial around it opened on the
//   first anniversary, 19 June 1993. Filed as "BMP-1" rather than "BMP-1P" so
//   future BMP-1 photos pool into one gallery card — the P is the Konkurs ATGM
//   fit, not a different vehicle.
//   Tiraspol: cast turret, long 85mm gun, twin cylindrical rear fuel drums,
//   five large road wheels — an unambiguous T-34-85. Tactical number 125 and
//   "ЗА РОДИНУ!" are painted on the turret. Reuses the existing T-34-85 row.
//
// COORDINATES are set by hand. These photos reached the machine through an
// image-sharing hop that stripped every EXIF tag except orientation, so there
// is no per-shot GPS to recover and no capture date either — date_taken stays
// null rather than being invented. Both points were resolved against Nominatim
// and accepted only because the returned display_name named the monument:
//   Bender   46.8306, 29.4882  [memorial] "Памятник защитникам Бендер (БМП),
//                                          улица Ткаченко, Центр, Бендеры"
//   Tiraspol 46.8354, 29.6082  [monument] "Мемориал Славы, Покровская улица,
//                                          Площадь Суворова, Тирасполь"
// They are 8.7 km apart, so they cannot collide the way the Ontario sites did.
//
// Run with:
//   node --env-file=.env.local scripts/upload-transnistria.mjs --dry-run
//   node --env-file=.env.local scripts/upload-transnistria.mjs

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/transnistria monuments';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

const GROUPS = [
  {
    name: 'BMP-1', type: 'vehicle', era: 'cold_war', nation: 'USSR',
    location: 'Memorial of Memory and Sorrow, Bender',
    lat: 46.8306, lng: 29.4882,
    files: ['bender-bmp1-1.jpg', 'bender-bmp1-2.jpg'],
  },
  {
    name: 'T-34-85', type: 'tank', era: 'ww2', nation: 'USSR',
    location: 'Memorial of Glory, Tiraspol',
    lat: 46.8354, lng: 29.6082,
    files: ['tiraspol-t34-1.jpg', 'tiraspol-t34-2.jpg'],
  },
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
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-pmr-'));

for (const g of GROUPS) {
  console.log(`\n=== ${g.name} — ${g.files.length} photo(s) [${g.type}/${g.era}/${g.nation}] ` +
              `@ ${g.location} ===`);

  let vehicle;
  try {
    vehicle = await findOrCreateVehicle(g);
    if (vehicle.created) vehiclesMade += 1;
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
      // .rotate() bakes in the EXIF orientation tag. These frames are stored
      // landscape with orientation=6, so without it every one lands sideways.
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
        location_taken: g.location, date_taken: null,
        lat: g.lat, lng: g.lng, sort_order: i,
      };

      if (DRY) {
        console.log(`  [dry] ${fname} -> ${storagePath} ${full.info.width}x${full.info.height} ` +
                    `gps=${g.lat},${g.lng}`);
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
      console.log(`  + ${fname} -> ${storagePath} (${full.info.width}x${full.info.height})`);
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
console.log('\nNo capture date on any of these four — EXIF was stripped upstream, so ' +
            'date_taken is null and they land under "Date unknown" in the timeline.');
