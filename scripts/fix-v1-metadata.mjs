// Force every v1-migrated vehicle's metadata (name, type, era, nation) to the
// catalog values below. The catalog is ground truth — derived from the original
// captions on tank-gallery.netlify.app — so this overrides whatever Gemini or
// anyone else wrote into the rows.
//
// Idempotent: run as many times as you want.
//
// Vehicles are matched by looking up the storage_path of their first photo
// (path pattern set by migrate-v1.mjs).
//
// Usage:
//   node --env-file=.env.local scripts/fix-v1-metadata.mjs

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const V1 = [
  // WW1
  { type: 'tank',      era: 'ww1',      nation: 'USA',         name: 'M1917',                 files: ['m1917.JPEG'] },
  { type: 'artillery', era: 'ww1',      nation: 'Germany',     name: '7.7-cm Feldkanone 16',  files: ['7.7feldkanone.jpeg'] },
  { type: 'artillery', era: 'ww1',      nation: 'Germany',     name: '15-cm Feldkanone L/40', files: ['15feldkanone.jpg'] },
  { type: 'artillery', era: 'ww1',      nation: 'Germany',     name: '15-cm Feldkanone L/45', files: ['15felkanone45.jpeg'] },
  // WW2
  { type: 'tank',      era: 'ww2',      nation: 'USA',         name: 'M24 Chaffee',           files: ['chaffee.JPEG', 'chaffee.JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'USA',         name: 'M5 Stuart',             files: ['m5.jpg'] },
  { type: 'tank',      era: 'ww2',      nation: 'USA',         name: 'M3 Lee',                files: ['m3lee.JPG', 'm3lee (2).JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'USA',         name: 'M4 Sherman',            files: ['m4.JPG', 'm4 (2).JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'UK',          name: 'M4 Sherman Crab',       files: ['crab.JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'UK',          name: 'Sherman Firefly',       files: ['firefly.JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'Canada',      name: 'Ram II',                files: ['ram2.jpg'] },
  { type: 'tank',      era: 'ww2',      nation: 'UK',          name: 'Matilda II',            files: ['matilda.jpg'] },
  { type: 'tank',      era: 'ww2',      nation: 'UK',          name: 'Valentine',             files: ['valentine.jpg', 'valentine (2).JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'UK',          name: 'Churchill',             files: ['churchill.jpg', 'churchill (2).JPG', 'churchill (3).JPG'] },
  { type: 'artillery', era: 'ww2',      nation: 'Canada',      name: 'Sexton',                files: ['sexton.jpg'] },
  { type: 'vehicle',   era: 'ww2',      nation: 'UK',          name: 'Ferret',                files: ['ferret.JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'USSR/Russia', name: 'T-34-85',               files: ['t3485.jpg', 't3485 (2).JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'Italy',       name: 'M 14/41',               files: ['m1441.jpg'] },
  { type: 'tank',      era: 'ww2',      nation: 'Germany',     name: 'Panzer II',             files: ['pz2.JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'Germany',     name: 'Panther',               files: ['panther.JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'Germany',     name: 'Sturmgeschütz III',     files: ['stug3.JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'Germany',     name: 'Hetzer',                files: ['hetzer.jpg'] },
  { type: 'tank',      era: 'ww2',      nation: 'Germany',     name: 'Jagdpanzer IV',         files: ['jgd4.JPG'] },
  { type: 'tank',      era: 'ww2',      nation: 'Germany',     name: 'Wirbelwind',            files: ['wirblewind.jpg'] },
  { type: 'artillery', era: 'ww2',      nation: 'Germany',     name: '8.8 cm KwK 36',         files: ['tigergun.jpg'] },
  // Cold War
  { type: 'tank',      era: 'cold_war', nation: 'UK',          name: 'Centurion',             files: ['centurion.JPG', 'centurion (2).JPG'] },
  { type: 'tank',      era: 'cold_war', nation: 'UK',          name: 'Chieftain Mk. 10',      files: ['chieftan.JPG'] },
  { type: 'tank',      era: 'cold_war', nation: 'Germany',     name: 'Leopard C1',            files: ['leopard1.jpg'] },
  { type: 'tank',      era: 'cold_war', nation: 'Germany',     name: 'Leopard C2',            files: ['leopard1 (2).JPG'] },
  { type: 'vehicle',   era: 'cold_war', nation: 'UK',          name: 'CVR(T) Sabre',          files: ['sabre.JPG'] },
  { type: 'vehicle',   era: 'cold_war', nation: 'Canada',      name: 'LAV III',               files: ['lav.jpg', 'lav (2).JPG', 'lav(3).jpg'] },
  { type: 'tank',      era: 'cold_war', nation: 'USA',         name: 'M60A3',                 files: ['m60.jpg', 'm60 (2).JPG', 'm60 (3).JPG'] },
  { type: 'artillery', era: 'cold_war', nation: 'USA',         name: 'M109 Paladin',          files: ['m109.JPG'] },
  { type: 'vehicle',   era: 'cold_war', nation: 'USA',         name: 'M577A3',                files: ['m577a3.JPG'] },
  { type: 'vehicle',   era: 'cold_war', nation: 'USA',         name: 'M113',                  files: ['m1113.JPG', 'm1113 (2).JPG'] },
  { type: 'tank',      era: 'cold_war', nation: 'USA',         name: 'M551 Sheridan',         files: ['sheridan.jpeg', 'sheridan.JPG'] },
  { type: 'tank',      era: 'cold_war', nation: 'USSR/Russia', name: 'T-55',                  files: ['t55.jpg'] },
  { type: 'tank',      era: 'cold_war', nation: 'Romania',     name: 'TR-85',                 files: ['tr85.JPEG'] },
  { type: 'tank',      era: 'cold_war', nation: 'USSR/Russia', name: 'T-72',                  files: ['t72.jpg', 't72 (2).JPG'] },
  // Aircraft (operationally Cold War era)
  { type: 'aircraft',  era: 'cold_war', nation: 'USA',         name: 'F-86 Sabre',            files: ['f86.jpg', 'f86 (2).JPG'] },
  { type: 'aircraft',  era: 'cold_war', nation: 'USSR/Russia', name: 'MiG-15',                files: ['mig15.jpeg'] },
  { type: 'aircraft',  era: 'cold_war', nation: 'Canada',      name: 'CF-116',                files: ['CF-116.jpg'] },
];

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function firstPhotoPath(entry) {
  const file = entry.files[0];
  const ext  = (file.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = slugify(file.replace(/\.[^.]+$/, '')) || '';
  return `v1/${base}-0.${ext}`;
}

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

let ok = 0, missing = 0, fail = 0;

for (const entry of V1) {
  const path = firstPhotoPath(entry);

  // Find the vehicle via its first photo's storage_path
  const { data: photo, error: lookupErr } = await supabase
    .from('photos')
    .select('vehicle_id')
    .eq('storage_path', path)
    .maybeSingle();

  if (lookupErr) {
    console.error(`✗ ${entry.name}: lookup failed — ${lookupErr.message}`);
    fail += 1;
    continue;
  }
  if (!photo) {
    console.log(`? ${entry.name}: no photo found at ${path}`);
    missing += 1;
    continue;
  }

  const { error: updErr } = await supabase
    .from('vehicles')
    .update({
      name:   entry.name,
      type:   entry.type,
      era:    entry.era,
      nation: entry.nation,
    })
    .eq('id', photo.vehicle_id);

  if (updErr) {
    console.error(`✗ ${entry.name}: update failed — ${updErr.message}`);
    fail += 1;
    continue;
  }

  // Also clear any stale ai_raw_response on all photos for this vehicle so
  // a future --only-untagged run knows these are intentionally human-labelled.
  await supabase
    .from('photos')
    .update({ ai_raw_response: { source: 'manual_v1' } })
    .eq('vehicle_id', photo.vehicle_id);

  console.log(`✓ ${entry.name} (${entry.nation})`);
  ok += 1;
}

console.log(`\nDone. ${ok} restored, ${missing} not found, ${fail} failed.`);
