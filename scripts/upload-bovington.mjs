// Upload the Bovington + Tyneham batch (29 Aug 2026) to Supabase.
//
// 205 photos across 84 subjects from The Tank Museum, Bovington, plus five
// landscape shots of range-target hulks on the Lulworth Ranges at Tyneham.
// Both location strings are matched by museums.ts (Bovington via
// match: ['tank museum', 'bovington']).
//
// Names come from the photo filenames, which carry the photographer's own rough
// labels, corrected against the exhibit placards visible in the frames and, for
// the WW1 tanks, against the museum's published collection. Where a placard was
// legible it wins; entries still resting on inference are listed in UNCERTAIN
// below so they can be corrected with a single UPDATE.
//
// WARNING: this script can no longer run. SRC below was deleted from Downloads
// after the upload completed, so readdirSync fails at startup. It is kept as the
// record of how the batch was catalogued, not as a re-runnable job.
//
// That deletion cost real quality. A later re-split of the WW1 group removed
// those 13 photo rows and their storage objects intending to rebuild them under
// corrected names — but by then the originals were gone. They were restored from
// 1500px working renders instead of the 2400px originals, and their per-photo
// EXIF GPS was replaced by the centroid of the surviving Bovington photos. The
// other 188 photos here are unaffected.
//
// The lesson is ordering: verify the source still exists BEFORE deleting rows,
// or run the upload first and let it fail closed.
//
// Run with (only if SRC is restored):
//   node --env-file=.env.local scripts/upload-bovington.mjs --dry-run
//   node --env-file=.env.local scripts/upload-bovington.mjs
//
// Safe to re-run: vehicles are matched by name, photos by storage path.

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/New Folder With Items';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

// Best guesses, not placard-confirmed. Listed here rather than buried so they
// are easy to find and fix later.
const UNCERTAIN = {
  'WW1 Heavy Tank': 'three interior frames — engine bay and transmission — with no exterior or placard in shot to identify which hull they belong to',
  'Mark VIII Liberty': 'IMG_1953 carries serial 12007, which the catalogue matches to the Mark VIII; IMG_1955 is a rear view of what appears to be the same green hull, grouped on appearance rather than a second number',
  'Mark IV': 'IMG_1948 placard reads MARK IV (MALE); IMG_1956 carries the display marking D52, which is a painted battle number rather than a catalogue serial and does not appear in the published collection',
  'Vickers Medium Mk II': 'hull number T1020, inferred from the layout',
  'Vickers Light Tank Mk VI': 'unlabelled frame; inferred from the twin-weapon turret',
  'Carden-Loyd Carrier': 'registration MT 9909 on an interwar display; type inferred from the open-topped tracked hull',
  'Cruiser Mk II (A10)': 'from the Battle for Greece display; the confirmed A9 is a separate exhibit',
  'Covenanter': 'hull number T9143, inferred from the turret and running gear',
  'Challenger 1': 'one frame placard-confirmed; the outdoor plinth tank grouped with it is inferred',
  'Challenger 2': 'inferred from the Iraq/Afghanistan display context',
  'Centurion': 'includes an "early turret" frame that may be a different mark, and IMG_2108 whose subject is under a tarpaulin and identified by the photographer rather than from the image',
  'T-55': 'includes a distant outdoor frame labelled "t55 recover" that may be an ARV rather than a gun tank',
};

// IMG_2108 shows a tarpaulin-covered hull behind a fence at distance, with
// nothing identifiable in frame. Filed under Centurion on the photographer's
// identification, not on anything visible in the photo.

const VEHICLES = [
  { name: "Little Willie", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["little willie?.HEIC"] },
  // The "mark 1s" group turned out to be several different vehicles. Full-
  // resolution re-reads made the placards and hull numbers legible, and those
  // numbers resolve against the museum's published WW1 collection:
  //
  //   IC 15   -> Mark IX APC (serial 936)
  //   12007   -> Mark VIII "Liberty"
  //   A259    -> Medium Mark A Whippet "Caesar II" — the tank Lt Cecil Sewell
  //              won a Victoria Cross from at Fremicourt, Aug 1918
  //   B46     -> Mark IV "Big Brute", the running replica built for War Horse
  //   285     -> Mark II "The Flying Scotsman" (handled separately below)
  { name: "Mark IV", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1948mark 1s.HEIC", "IMG_1956mark 1s.HEIC"] },
  { name: "Mark V", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1950mark 1s.HEIC", "IMG_1954mark 1s.HEIC"] },
  { name: "Mark IX", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1949mark 1s.HEIC"] },
  { name: "Mark VIII Liberty", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1953mark 1s.HEIC", "IMG_1955mark 1s.HEIC"] },
  { name: "Medium Mark A Whippet - Caesar II", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1893.HEIC"] },
  { name: "Mark IV - Big Brute (Replica)", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["another mark I.HEIC", "IMG_1957mark 1s.HEIC"] },
  // Three interior frames with no identifiable exterior in shot.
  { name: "WW1 Heavy Tank", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1951mark 1s.HEIC", "IMG_1952mark 1s.HEIC", "inside mark.HEIC"] },
  { name: "Comet", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1961comet.HEIC", "IMG_1962comet.HEIC", "IMG_1963comet.HEIC", "IMG_1964comet.HEIC", "IMG_1965comet.HEIC", "IMG_1966comet.HEIC"] },
  { name: "Churchill Mk VII", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1934churchill mk7.HEIC", "IMG_1935churchill mk7.HEIC"] },
  { name: "Churchill Mk IV", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2041Churchill IV.HEIC", "IMG_2042Churchill IV.HEIC", "IMG_2043Churchill IV.HEIC"] },
  { name: "Churchill Mk II", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["churchill II.HEIC"] },
  { name: "Churchill AVRE", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2006churchill AVRE.HEIC", "IMG_2007churchill AVRE.HEIC"] },
  { name: "Matilda I", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["another matilda I again.HEIC", "another matilda I.HEIC", "matidla .HEIC", "matilda 1.HEIC"] },
  { name: "Matilda II", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1978another matilda II.HEIC", "IMG_1979another matilda II.HEIC", "IMG_1980another matilda II.HEIC"] },
  { name: "Valentine", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["valentine.HEIC"] },
  { name: "Valentine Bridgelayer", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["Valentine Bridgelayer.HEIC"] },
  { name: "Valentine Archer", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["valentine archer.HEIC"] },
  { name: "Cruiser Mk I (A9)", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["a9 cruiser.HEIC"] },
  { name: "Cruiser Mk II (A10)", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1982battle for greece, some cruiser idk.HEIC", "IMG_1983battle for greece, some cruiser idk.HEIC"] },
  { name: "Covenanter", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["one of the cruiser tnaks.HEIC"] },
  { name: "Tetrarch", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["tetrach.HEIC"] },
  { name: "Centaur Dozer", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["centaur dozer.HEIC"] },
  { name: "Tortoise", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2079tortoise.HEIC", "IMG_2080tortoise.HEIC"] },
  { name: "TOG II", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2081tog II.HEIC", "IMG_2082tog II.HEIC", "tog II .HEIC"] },
  { name: "AEC Armoured Car", type: "vehicle", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["aec armour car.HEIC"] },
  { name: "Beaverette", type: "vehicle", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["beaverette.HEIC"] },
  { name: "Sherman Firefly", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["firefly.HEIC"] },
  { name: "M4 Sherman Crab", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["sherman crab.HEIC"] },
  { name: "M10 Achilles", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2028m10 achilles.HEIC", "IMG_2029m10 achilles.HEIC", "IMG_2030m10 achilles.HEIC"] },
  { name: "M4A1 Sherman - Michael", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["another m4a1 sherman michael.HEIC", "m4a1 sherman.HEIC"] },
  { name: "M4A2E8 Sherman - Fury", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["fury sherman.HEIC", "sherman (FROM FURY PLEASE INCLUDE)\\.HEIC"] },
  { name: "M3 Lee", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1997m3 lee.HEIC", "IMG_1998m3 lee.HEIC"] },
  { name: "M3 Stuart", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1984m3 stuart.HEIC", "IMG_1985m3 stuart.HEIC", "IMG_1986m3 stuart.HEIC"] },
  { name: "M5 Stuart", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["m5 stuart.HEIC"] },
  { name: "M24 Chaffee", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["another chaffee.HEIC", "chafee.HEIC", "chaffee.HEIC"] },
  { name: "Ram Mk II", type: "tank", era: "ww2", nation: "Canada",
    location: "The Tank Museum, Bovington",
    files: ["ram 2.HEIC"] },
  { name: "Ram Kangaroo", type: "vehicle", era: "ww2", nation: "Canada",
    location: "The Tank Museum, Bovington",
    files: ["ram kangarro.HEIC"] },
  { name: "T-34-76", type: "tank", era: "ww2", nation: "USSR",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1939finish capture t3476.HEIC", "IMG_1940finish capture t3476.HEIC"] },
  { name: "T-34-85", type: "tank", era: "ww2", nation: "USSR",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2064t3485.HEIC", "IMG_2065t3485.HEIC"] },
  { name: "Carro Veloce L3", type: "tank", era: "ww2", nation: "Italy",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1991Carro L3.HEIC", "IMG_1992Carro L3.HEIC", "IMG_1993Carro L3.HEIC"] },
  { name: "M14/41", type: "tank", era: "ww2", nation: "Italy",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1973m14:41.HEIC", "IMG_1975m14:41.HEIC", "IMG_1976m14:41.HEIC", "IMG_1977m14:41.HEIC"] },
  { name: "Type 95 Ha-Go", type: "tank", era: "ww2", nation: "Japan",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2003Ha-Go.HEIC", "IMG_2004Ha-Go.HEIC"] },
  { name: "Centurion", type: "tank", era: "cold_war", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1931centurion.HEIC", "IMG_1932centurion.HEIC", "IMG_1933centurion.HEIC", "early turret centurion.HEIC",
            "IMG_2108.HEIC"] },
  { name: "Centurion (Sectioned)", type: "tank", era: "cold_war", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2104cut apart centurion.HEIC", "IMG_2106cut apart centurion.HEIC"] },
  { name: "Conqueror", type: "tank", era: "cold_war", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2073conqueror.HEIC", "IMG_2074conqueror.HEIC"] },
  { name: "Chieftain", type: "tank", era: "cold_war", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["chieftan another.HEIC", "some chieftan.HEIC"] },
  { name: "FV432 Ambulance", type: "vehicle", era: "cold_war", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["idk some medical evac apc idk.HEIC"] },
  { name: "Challenger 1", type: "tank", era: "modern", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["another challenger 1 or 2 idk.HEIC", "challenger.HEIC"] },
  { name: "Challenger 2", type: "tank", era: "modern", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1924challenger.HEIC", "IMG_1925challenger.HEIC", "challenger II another.HEIC", "challenger II.HEIC"] },
  { name: "M48 Patton", type: "tank", era: "cold_war", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1928m48 patton.HEIC", "IMG_1929m48 patton.HEIC"] },
  { name: "M113", type: "vehicle", era: "cold_war", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["m1113.HEIC"] },
  { name: "T-55", type: "tank", era: "cold_war", nation: "USSR",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2109some t55s.HEIC", "IMG_2110some t55s.HEIC", "another t55.HEIC", "t55 recover.HEIC", "t55s.HEIC"] },
  { name: "T-62", type: "tank", era: "cold_war", nation: "USSR",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1920t62.HEIC", "IMG_1921t62.HEIC", "IMG_1922t62.HEIC", "IMG_1923t62.HEIC"] },
  { name: "T-72", type: "tank", era: "cold_war", nation: "USSR",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1926t72.HEIC", "IMG_1927t72.HEIC", "another t72.HEIC"] },
  { name: "Type 59", type: "tank", era: "cold_war", nation: "China",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2095type 59.HEIC", "IMG_2096type 59.HEIC"] },
  { name: "AMX-13", type: "tank", era: "cold_war", nation: "France",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2100amx 13.HEIC", "IMG_2101amx 13.HEIC", "IMG_2102amx 13.HEIC"] },
  { name: "Leopard 2", type: "tank", era: "modern", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["leopard2.HEIC"] },
  { name: "Marder 1 IFV", type: "vehicle", era: "cold_war", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2086marder.HEIC", "IMG_2087marder.HEIC", "IMG_2088marder.HEIC"] },
  { name: "Tank Gun Barrels", type: "other", era: "other", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["various cannons.HEIC"] },
  { name: "Range Target Hulks", type: "other", era: "other", nation: "UK",
    location: "Tyneham Range, Lulworth Ranges, Dorset",
    files: ["IMG_2134Tyneham Range.HEIC", "IMG_2135Tyneham Range.HEIC", "IMG_2136Tyneham Range.HEIC", "IMG_2137Tyneham Range.HEIC", "IMG_2160Tyneham Range.HEIC"] },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

globalThis.WebSocket = WebSocket;
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Filenames here are the photographer's labels and get edited in place, so
// resolve exact-first and fall back to the IMG_NNNN prefix the label was
// appended to. Storage paths key off that stable number, never the label.
const DIR = readdirSync(SRC).filter((n) => /\.heic$/i.test(n));

function resolveSource(entry) {
  if (DIR.includes(entry)) return entry;
  const m = entry.match(/^(IMG_\d{4})/);
  if (m) {
    const hits = DIR.filter((n) => n.startsWith(m[1]));
    if (hits.length === 1) return hits[0];
  }
  throw new Error(`no file in ${SRC} matches "${entry}"`);
}

// Storage stem: the camera's number when present, otherwise a slug of the
// label. Either way it is stable across renames of the source file.
function storageStem(entry) {
  const m = entry.match(/^(IMG_\d{4})/);
  return m ? m[1].toLowerCase() : slugify(entry.replace(/\.heic$/i, ''));
}

function readExif(file) {
  try {
    const out = execFileSync('/usr/bin/mdls', [
      '-name', 'kMDItemContentCreationDate',
      '-name', 'kMDItemLatitude',
      '-name', 'kMDItemLongitude',
      file,
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
  if (/\.heic$/i.test(file)) {
    const out = path.join(workDir, `${path.basename(file, path.extname(file))}.jpg`);
    execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', file, '--out', out], { stdio: 'ignore' });
    return readFileSync(out);
  }
  return readFileSync(file);
}

async function findOrCreateVehicle(v) {
  const { data: existing, error: selErr } = await supabase
    .from('vehicles').select('id').eq('name', v.name).maybeSingle();
  if (selErr) throw selErr;
  if (existing) return { id: existing.id, created: false };
  if (DRY) return { id: '(dry-run)', created: true };

  const { data, error } = await supabase
    .from('vehicles')
    .insert({ name: v.name, type: v.type, era: v.era, nation: v.nation })
    .select('id').single();
  if (error) throw error;
  return { id: data.id, created: true };
}

let vehiclesMade = 0, photosMade = 0, skipped = 0, failed = 0;
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-bov-'));

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

  for (const [i, entry] of v.files.entries()) {
    let src;
    try {
      src = path.join(SRC, resolveSource(entry));
    } catch (e) {
      console.error(`  x ${entry}: ${e.message}`);
      failed += 1;
      continue;
    }

    const stem = storageStem(entry);
    const storagePath = `uploads/${slug}/${stem}.jpg`;
    const thumbPath = `uploads/${slug}/${stem}-thumb.jpg`;

    try {
      const exif = readExif(src);
      const raw = toJpegBuffer(src, workDir);

      const pipeline = sharp(raw).rotate();
      const full = await pipeline
        .clone().resize(FULL_MAX, FULL_MAX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      const thumb = await pipeline
        .clone().resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true }).toBuffer();

      const { data: px, info } = await pipeline
        .clone().raw().ensureAlpha().resize(32, 32, { fit: 'inside' })
        .toBuffer({ resolveWithObject: true });
      const blurhash = encode(new Uint8ClampedArray(px), info.width, info.height, 4, 4);

      const row = {
        vehicle_id: vehicle.id,
        storage_path: storagePath,
        thumbnail_path: thumbPath,
        blurhash,
        width: full.info.width,
        height: full.info.height,
        location_taken: v.location,
        date_taken: exif.date_taken,
        lat: exif.lat,
        lng: exif.lng,
        sort_order: i,
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
      console.error(`  x ${entry}: ${e.message ?? e}`);
      failed += 1;
    }
  }
}

rmSync(workDir, { recursive: true, force: true });

console.log(`\n${DRY ? 'DRY RUN — nothing written.' : 'Done.'} ` +
            `vehicles: ${vehiclesMade}, photos: ${photosMade}, skipped: ${skipped}, failed: ${failed}`);

console.log(`\n${Object.keys(UNCERTAIN).length} name(s) are inference, not placard-confirmed:`);
for (const [n, why] of Object.entries(UNCERTAIN)) console.log(`  ${n} — ${why}`);
