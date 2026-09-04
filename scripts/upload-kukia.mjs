// Upload the Kukia war necropolis SU-100 to Supabase.
//
//   SU-100 — Zemo Kukia Soviet-German war necropolis, 54b Norio St, Tbilisi
//
// Not a museum: an open memorial standing on the paving beside the 1941-45
// Soviet mass grave, so there is no placard and nothing was cropped out.
//
// IDENTIFICATION — this is an SU-100 tank destroyer, not a T-34.
//   There is no turret at all: the gun sits in a cast ball mantlet let into a
//   fixed casemate superstructure, which rules out the whole T-34 family the
//   running gear otherwise suggests (five large Christie road wheels, no
//   return rollers, T-34 track links — the SU-100 is built on that chassis).
//   SU-100 over SU-85 rests on the commander's cupola: it stands on a faceted
//   sponson that bulges out over the right-hand side of the casemate roof,
//   plainly visible in photo 3. A standard SU-85 has no cupola there and a
//   flush roof. The 100mm D-10S is long and untapered with no muzzle brake,
//   which is what photo 2 shows. The one vehicle that shares the sponson but
//   not the gun is the SU-85M, of which about 315 were built in late 1944 —
//   rare enough against the thousands of SU-100s left standing as monuments
//   across the former USSR that it is not the reading to take here.
//   Filed on the existing "SU-100" vehicle row so this pools with the Le MM
//   Park, Karlshorst and War Memorial of Korea frames already in the archive.
//
// COORDINATES are set by hand. These photos reached the machine pasted into a
// chat, which strips every EXIF tag except orientation, so there is no
// per-shot GPS to recover. The point is OSM node 7685460074, tagged
// `historic=tank`, which is the vehicle itself rather than a site centroid:
//   41.7147, 44.8185
// The war memorial node beside it (11583749698, name:ru "1941-45 братская
// могила советских войск") sits 60 m away, so the two cannot be confused.
// Do not use "Mukhatgverdi Brothers' Cemetery" for this — that is a separate
// military cemetery 8 km west in Saburtalo.
//
// DATE is 2026-09-04, taken from the photographer standing at the memorial
// and saying so, not inferred from a file timestamp.
//
// Run with:
//   node --env-file=.env.local scripts/upload-kukia.mjs --dry-run
//   node --env-file=.env.local scripts/upload-kukia.mjs

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/kukia tbilisi';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

const GROUPS = [
  {
    name: 'SU-100', type: 'tank', era: 'ww2', nation: 'USSR',
    location: 'Kukia War Necropolis, Tbilisi',
    lat: 41.7147, lng: 44.8185,
    date: '2026-09-04',
    files: ['kukia-su100-1.jpg', 'kukia-su100-2.jpg', 'kukia-su100-3.jpg'],
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
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-kukia-'));

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
        location_taken: g.location, date_taken: g.date,
        lat: g.lat, lng: g.lng, sort_order: i,
      };

      if (DRY) {
        console.log(`  [dry] ${fname} -> ${storagePath} ${full.info.width}x${full.info.height} ` +
                    `date=${g.date} gps=${g.lat},${g.lng}`);
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
