// Re-identify 18 mislabelled photos in the RAF Museum London batch.
//
// upload-raf-hendon.mjs named 36 subjects from unlabelled files. Most were
// placard-confirmed and correct, but a whole class of error slipped through:
// where several exhibits stood in one bay, consecutive frames were assumed to
// be the same aircraft as the placard that opened the run. That put a Mustang
// under "Messerschmitt Me 262", an Me 163 and a Ferret under "Avro Vulcan", a
// Ki-100 under "B-24 Liberator", and so on.
//
// Every move below was re-checked against the full-resolution frame, and the
// resulting types were cross-checked against the museum's published collection
// (Stranraer 920, Halifax II W1048, Beaufort VIII DD931, Me 163B-1a 191614,
// P-51D 413317, Ki-100, Jaguar are all confirmed Hendon airframes).
//
// Storage objects are MOVED, not copied and not deleted, so the path keeps
// matching the vehicle slug and upload-raf-hendon.mjs stays idempotent — its
// duplicate check is by storage_path, so a stale path would make a re-run
// upload the same photo twice. A row is only updated after its object has
// actually moved; a failed move leaves the row untouched.
//
// Run with:
//   node --env-file=.env.local scripts/fix-raf-hendon-ids.mjs --dry-run
//   node --env-file=.env.local scripts/fix-raf-hendon-ids.mjs

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const DRY = process.argv.includes('--dry-run');
const LOCATION = 'RAF Museum London';
const BUCKET = 'photos';

// New subjects this batch needs. `Ferret` already exists in the archive and is
// genuinely the same vehicle, so it is reused rather than duplicated. The
// Phantom is NOT pooled into the existing `F-4E Phantom II`: Hendon's is an
// RAF FGR.2, a Spey-engined British variant, not an F-4E.
const SUBJECTS = {
  'SEPECAT Jaguar':              { type: 'aircraft', era: 'cold_war', nation: 'UK' },
  'Bristol Beaufort':            { type: 'aircraft', era: 'ww2',      nation: 'UK' },
  'Supermarine Stranraer':       { type: 'aircraft', era: 'ww2',      nation: 'UK' },
  'Fiat CR.42 Falco':            { type: 'aircraft', era: 'ww2',      nation: 'Italy' },
  'Phantom FGR.2':               { type: 'aircraft', era: 'cold_war', nation: 'USA' },
  'Hawker Tempest':              { type: 'aircraft', era: 'ww2',      nation: 'UK' },
  'Kawasaki Ki-100':             { type: 'aircraft', era: 'ww2',      nation: 'Japan' },
  'Handley Page Halifax':        { type: 'aircraft', era: 'ww2',      nation: 'UK' },
  'Messerschmitt Me 163 Komet':  { type: 'aircraft', era: 'ww2',      nation: 'Germany' },
  'North American P-51D Mustang':{ type: 'aircraft', era: 'ww2',      nation: 'USA' },
  'Ferret':                      { type: 'vehicle',  era: 'cold_war', nation: 'UK' },
  'Hawker Typhoon':              { type: 'aircraft', era: 'ww2',      nation: 'UK' },
  'Jet Cockpit':                 { type: 'other',    era: 'cold_war', nation: 'UK' },
  'Blackburn Buccaneer':         { type: 'aircraft', era: 'cold_war', nation: 'UK' },
};

// stem                was                          becomes                        why
const MOVES = [
  ['img_2308', 'Eurofighter Typhoon',        'SEPECAT Jaguar',              'rectangular side intakes, shoulder wing, code AD, maintenance serial 9019M — a Jaguar GR1, not the black Typhoon in IMG_2307'],
  ['img_2310', 'Panavia Tornado',            'SEPECAT Jaguar',              'the same AD-coded airframe head-on; no Tornado was photographed'],
  ['img_2312', 'Harrier GR',                 'Blackburn Buccaneer',         'UNCERTAIN — desert-pink airframe with a circular intake and tandem canopies, matching XW547 in the neighbouring frames; a grey Harrier is visible behind it'],
  ['img_2319', 'Supermarine Spitfire',       'Hawker Typhoon',              'head-on: chin radiator under the spinner and invasion stripes — the Typhoon of IMG_2320/2321, not a Spitfire'],
  ['img_2322', 'Hawker Typhoon',             'Jet Cockpit',                 'bare-metal wing root with an ejection seat and REAR SEAT placard — the same cutaway jet as IMG_2323/2325'],
  ['img_2329', 'de Havilland Mosquito',      'Bristol Beaufort',            'twin radials, dorsal turret and a yellow kangaroo — the Beaufort VIII; a Mosquito has no turret'],
  ['img_2330', 'Short Sunderland',           'Supermarine Stranraer',       'biplane flying boat coded QN- and numbered 920 — the Stranraer, a different airframe from Sunderland ML824 in IMG_2299'],
  ['img_2331', 'Short Sunderland',           'Supermarine Stranraer',       'same airframe as IMG_2330'],
  ['img_2335', 'Gloster Gladiator',          'Fiat CR.42 Falco',            'Italian mottled camouflage, yellow cowl, MM serial — the CR.42 in the Battle of Britain hall'],
  ['img_2336', 'Gloster Gladiator',          'Phantom FGR.2',               'twin-seat Phantom with anhedral tailplane and RAF roundel — nothing to do with a Gladiator'],
  ['img_2338', 'de Havilland Vampire',       'Hawker Tempest',              'chin radiator, red spinner, yellow/black target-tug undersides — Tempest TT.5, not the silver Vampire of IMG_2337'],
  ['img_2344', 'Consolidated B-24 Liberator','Kawasaki Ki-100',             'its own placard reads "Kawasaki Ki-100-1b"; the Liberator is the aircraft behind it'],
  ['img_2350', 'Heinkel He 111',             'Handley Page Halifax',        'unrestored corroded fuselage recovered from a lake — Halifax II W1048, not the intact He 111'],
  ['img_2358', 'Avro Vulcan',                'Ferret',                      'placard reads "Daimler Ferret scout car"; it is parked under the Vulcan, not part of it'],
  ['img_2359', 'Avro Vulcan',                'Messerschmitt Me 163 Komet',  'yellow-nosed rocket interceptor, W.Nr 191461 — the Vulcan XL318 is only the tail behind it'],
  ['img_2361', 'Messerschmitt Me 262',       'Messerschmitt Me 163 Komet',  'same Komet; no Me 262 was photographed at all'],
  ['img_2362', 'Messerschmitt Me 262',       'Messerschmitt Me 163 Komet',  'the Komet’s own placard'],
  ['img_2363', 'Messerschmitt Me 262',       'North American P-51D Mustang','bare-metal Mustang with a red spinner and invasion stripes'],
];

// Subjects that end this run with no photos left. Listed explicitly so an
// unexpected empty vehicle is reported rather than silently deleted.
const EXPECT_EMPTY = [
  'Panavia Tornado', 'Harrier GR', 'Gloster Gladiator',
  'Messerschmitt Me 262', 'de Havilland Mosquito',
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

async function findOrCreateVehicle(name) {
  const spec = SUBJECTS[name];
  if (!spec) throw new Error(`${name} is not in SUBJECTS`);
  const { data: existing, error } = await supabase
    .from('vehicles').select('id').eq('name', name).maybeSingle();
  if (error) throw error;
  if (existing) return { id: existing.id, created: false };
  if (DRY) return { id: '(dry-run)', created: true };
  const { data, error: insErr } = await supabase
    .from('vehicles').insert({ name, ...spec }).select('id').single();
  if (insErr) throw insErr;
  return { id: data.id, created: true };
}

let moved = 0, made = 0, failed = 0;

for (const [stem, was, becomes, why] of MOVES) {
  const { data: rows, error } = await supabase
    .from('photos')
    .select('id, storage_path, thumbnail_path, vehicles(name)')
    .eq('location_taken', LOCATION)
    .like('storage_path', `%/${stem}.jpg`);

  if (error)          { console.error(`x ${stem}: ${error.message}`); failed += 1; continue; }
  if (rows.length !== 1) { console.error(`x ${stem}: matched ${rows.length} rows`); failed += 1; continue; }

  const row = rows[0];
  if (row.vehicles.name !== was) {
    console.log(`- ${stem}: already on "${row.vehicles.name}" (expected "${was}") — skipping`);
    continue;
  }

  let vehicle;
  try {
    vehicle = await findOrCreateVehicle(becomes);
    if (vehicle.created) made += 1;
  } catch (e) { console.error(`x ${stem}: ${e.message}`); failed += 1; continue; }

  const slug = slugify(becomes);
  const newFull  = `uploads/${slug}/${stem}.jpg`;
  const newThumb = `uploads/${slug}/${stem}-thumb.jpg`;

  console.log(`\n${stem}: ${was} -> ${becomes}${vehicle.created ? '  [new subject]' : ''}`);
  console.log(`  ${why}`);
  console.log(`  ${row.storage_path} -> ${newFull}`);

  if (DRY) { moved += 1; continue; }

  let ok = true;
  for (const [from, to] of [[row.storage_path, newFull], [row.thumbnail_path, newThumb]]) {
    if (!from || from === to) continue;
    const { error: mvErr } = await supabase.storage.from(BUCKET).move(from, to);
    if (mvErr) { console.error(`  x move ${from}: ${mvErr.message}`); ok = false; break; }
  }
  if (!ok) { failed += 1; continue; }

  const { error: upErr } = await supabase
    .from('photos')
    .update({ vehicle_id: vehicle.id, storage_path: newFull, thumbnail_path: newThumb })
    .eq('id', row.id);
  if (upErr) { console.error(`  x row update: ${upErr.message}`); failed += 1; continue; }
  moved += 1;
}

// Clean up the subjects those moves emptied.
console.log('\n--- emptied subjects ---');
let removed = 0;
for (const name of EXPECT_EMPTY) {
  const { data: v } = await supabase.from('vehicles').select('id').eq('name', name).maybeSingle();
  if (!v) { console.log(`- ${name}: already gone`); continue; }
  const { count } = await supabase
    .from('photos').select('id', { count: 'exact', head: true }).eq('vehicle_id', v.id);
  if (count) { console.log(`! ${name}: still has ${count} photo(s) — left alone`); continue; }
  if (DRY) { console.log(`  [dry] would delete empty vehicle ${name}`); removed += 1; continue; }
  const { error } = await supabase.from('vehicles').delete().eq('id', v.id);
  if (error) { console.error(`x ${name}: ${error.message}`); failed += 1; continue; }
  console.log(`  deleted empty vehicle ${name}`);
  removed += 1;
}

console.log(`\n${DRY ? 'DRY RUN — nothing written.' : 'Done.'} ` +
            `moved: ${moved}, new subjects: ${made}, emptied vehicles removed: ${removed}, failed: ${failed}`);

// The batch must still be exactly 71 photos, and no vehicle row anywhere may be
// left photoless — an orphan would show up as a phantom filter option.
const { count: total } = await supabase
  .from('photos').select('id', { count: 'exact', head: true }).eq('location_taken', LOCATION);
console.log(`\n${LOCATION}: ${total} photos (expected 71)`);

const { data: allV } = await supabase.from('vehicles').select('id, name, photos(count)');
const orphans = allV.filter((v) => (v.photos[0]?.count ?? 0) === 0);
console.log(orphans.length
  ? `ORPHAN VEHICLES: ${orphans.map((v) => v.name).join(', ')}`
  : 'no vehicle row is left without photos');
