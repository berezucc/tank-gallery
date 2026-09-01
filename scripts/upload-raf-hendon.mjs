// Upload the RAF Museum London (Hendon) batch (31 Aug 2026) to Supabase.
//
// 71 photos across 36 subjects. The files arrived unlabelled, so every name
// here comes from identification: wherever a lectern placard was in frame it
// was read at full resolution and its wording wins. Rendering at 1600px rather
// than thumbnail size is what made that possible — at 560px none of these
// placards are legible.
//
// Placard-confirmed: Spitfire LF.XVIe, Avro 504K, Albatros D.Va, B.E.2b,
// Beaufighter TF.X, Hawker Typhoon IB, Gloster Meteor F8, Avro Vulcan B Mk 2
// "Tin Triangle" (617 Sqn), Junkers Ju 87D/G-2, Messerschmitt Bf 110G-4,
// Heinkel He 162 Volksjager, Blackburn Buccaneer XW547, Short Sunderland ML824.
//
// Run with:
//   node --env-file=.env.local scripts/upload-raf-hendon.mjs --dry-run
//   node --env-file=.env.local scripts/upload-raf-hendon.mjs
//
// Safe to re-run: vehicles are matched by name, photos by storage path.

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/RAF london museum';
const LOCATION = 'RAF Museum London';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

// Names resting on inference rather than a legible placard.
const UNCERTAIN = {
  'RAF Armoured Car': 'an RAF-marked wheeled armoured car named FRIGHT in desert scheme; the type is not readable in frame',
  'Short Sunderland': 'IMG_2299 shows codes NS-Z, but IMG_2330/2331 are a flying boat coded QN- and numbered 920 photographed in a different hall — possibly a second airframe rather than the same one',
  'Sopwith Camel': 'a WW1 rotary-engined scout hanging in the Grahame-White hangar; the museum shows several similar types and no placard is in shot',
  'Eurofighter Typhoon': 'IMG_2307 is clearly a Typhoon; IMG_2308 is a grey swing-wing jet coded AD grouped with it that may instead be a Tornado',
  'Harrier GR': 'desert-scheme Harrier; the GR mark is not determinable from the frame',
  'Jet Cockpit': 'three cockpit interiors with no exterior in shot — the instrument labelling suggests a Buccaneer or Tornado',
  'Air-Launched Weapons': 'a rack of missiles and guided bombs rather than a single vehicle',
};

const VEHICLES = [
  { name: "Supermarine Spitfire", type: "aircraft", era: "ww2", nation: "UK",
    files: ["IMG_2293", "IMG_2317", "IMG_2318", "IMG_2319"] },
  { name: "Avro Blue Steel", type: "other", era: "cold_war", nation: "UK",
    files: ["IMG_2294", "IMG_2295"] },
  { name: "RAF Armoured Car", type: "vehicle", era: "ww2", nation: "UK",
    files: ["IMG_2296"] },
  { name: "F-35 Lightning II", type: "aircraft", era: "modern", nation: "USA",
    files: ["IMG_2297", "IMG_2298"] },
  { name: "Short Sunderland", type: "aircraft", era: "ww2", nation: "UK",
    files: ["IMG_2299", "IMG_2330", "IMG_2331"] },
  { name: "RAF Rescue Launch", type: "ship", era: "ww2", nation: "UK",
    files: ["IMG_2300"] },
  { name: "Bleriot XXVII", type: "aircraft", era: "ww1", nation: "France",
    files: ["IMG_2301"] },
  { name: "Avro 504K", type: "aircraft", era: "ww1", nation: "UK",
    files: ["IMG_2302"] },
  { name: "Royal Aircraft Factory B.E.2b", type: "aircraft", era: "ww1", nation: "UK",
    files: ["IMG_2303"] },
  { name: "Albatros D.Va", type: "aircraft", era: "ww1", nation: "Germany",
    files: ["IMG_2304"] },
  { name: "Halberstadt CL.IV", type: "aircraft", era: "ww1", nation: "Germany",
    files: ["IMG_2305"] },
  { name: "Sopwith Camel", type: "aircraft", era: "ww1", nation: "UK",
    files: ["IMG_2306"] },
  { name: "Eurofighter Typhoon", type: "aircraft", era: "modern", nation: "UK",
    files: ["IMG_2307", "IMG_2308"] },
  { name: "Air-Launched Weapons", type: "other", era: "modern", nation: "UK",
    files: ["IMG_2309"] },
  { name: "Panavia Tornado", type: "aircraft", era: "modern", nation: "UK",
    files: ["IMG_2310"] },
  { name: "Blackburn Buccaneer", type: "aircraft", era: "cold_war", nation: "UK",
    files: ["IMG_2311", "IMG_2313", "IMG_2314"] },
  { name: "Harrier GR", type: "aircraft", era: "modern", nation: "UK",
    files: ["IMG_2312"] },
  { name: "MQ-9 Reaper", type: "aircraft", era: "modern", nation: "USA",
    files: ["IMG_2315", "IMG_2316"] },
  { name: "Hawker Typhoon", type: "aircraft", era: "ww2", nation: "UK",
    files: ["IMG_2320", "IMG_2321", "IMG_2322"] },
  { name: "Jet Cockpit", type: "other", era: "cold_war", nation: "UK",
    files: ["IMG_2323", "IMG_2324", "IMG_2325"] },
  { name: "Bristol Beaufighter", type: "aircraft", era: "ww2", nation: "UK",
    files: ["IMG_2327", "IMG_2328"] },
  { name: "de Havilland Mosquito", type: "aircraft", era: "ww2", nation: "UK",
    files: ["IMG_2329"] },
  { name: "Hawker Hurricane", type: "aircraft", era: "ww2", nation: "UK",
    files: ["IMG_2332", "IMG_2368"] },
  { name: "Messerschmitt Bf 109", type: "aircraft", era: "ww2", nation: "Germany",
    files: ["IMG_2333", "IMG_2334"] },
  { name: "Gloster Gladiator", type: "aircraft", era: "ww2", nation: "UK",
    files: ["IMG_2335", "IMG_2336"] },
  { name: "de Havilland Vampire", type: "aircraft", era: "cold_war", nation: "UK",
    files: ["IMG_2337", "IMG_2338"] },
  { name: "Gloster Meteor F8", type: "aircraft", era: "cold_war", nation: "UK",
    files: ["IMG_2339"] },
  { name: "English Electric Lightning", type: "aircraft", era: "cold_war", nation: "UK",
    files: ["IMG_2340", "IMG_2341"] },
  { name: "Consolidated B-24 Liberator", type: "aircraft", era: "ww2", nation: "USA",
    files: ["IMG_2343", "IMG_2344"] },
  { name: "Yokosuka MXY-7 Ohka", type: "aircraft", era: "ww2", nation: "Japan",
    files: ["IMG_2345"] },
  { name: "Junkers Ju 87 Stuka", type: "aircraft", era: "ww2", nation: "Germany",
    files: ["IMG_2346", "IMG_2347"] },
  { name: "Heinkel He 111", type: "aircraft", era: "ww2", nation: "Germany",
    files: ["IMG_2348", "IMG_2349", "IMG_2350"] },
  { name: "Messerschmitt Bf 110", type: "aircraft", era: "ww2", nation: "Germany",
    files: ["IMG_2351", "IMG_2352", "IMG_2353"] },
  { name: "Avro Vulcan", type: "aircraft", era: "cold_war", nation: "UK",
    files: ["IMG_2354", "IMG_2355", "IMG_2356", "IMG_2357", "IMG_2358", "IMG_2359"] },
  { name: "Messerschmitt Me 262", type: "aircraft", era: "ww2", nation: "Germany",
    files: ["IMG_2361", "IMG_2362", "IMG_2363"] },
  { name: "Heinkel He 162", type: "aircraft", era: "ww2", nation: "Germany",
    files: ["IMG_2364", "IMG_2365"] },
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
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-raf-'));

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
