// Re-file the five Astana main-battle-tank photos from T-72 to T-64.
//
// WHY. The original Astana pass called these T-72. That was wrong, and the way
// it went wrong is worth recording: the running gear was examined first and
// read correctly as small, closely-spaced road wheels with metal rims and a
// ring of round lightening holes — T-64/T-80 family, not T-72, whose wheels are
// large, dished and thickly tyred with wider gaps. That direct observation was
// then overridden because a travel-site summary of the museum's collection
// mentioned "танк Т-72". A secondary source beat a first-hand read of the
// photograph, which is exactly backwards. The photographer, who was standing in
// front of it, says T-64; a re-crop of the running gear agrees.
//
// SCOPE. Only the five Astana frames move. The T-72 row also holds Bovington,
// Canadian War Museum and CFB Borden photos, and those are untouched and stay
// on T-72.
//
// Storage objects are moved too, not just the rows. If the object stayed at
// uploads/t-72/... while the row pointed at T-64, upload-astana.mjs would
// compute uploads/t-64/... on its next run, miss the dedupe check and upload a
// second copy of all five. Moving both keeps that script idempotent.
//
// Run with:
//   node --env-file=.env.local scripts/fix-astana-t64.mjs --dry-run
//   node --env-file=.env.local scripts/fix-astana-t64.mjs

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const BUCKET = 'photos';
const SRC_DIR = '/Users/nikita/Downloads/astana military museum';
const LOCATION = 'State Military-Historical Museum, Astana';
const FROM_NAME = 'T-72';
const TO_NAME = 'T-64';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}
globalThis.WebSocket = WebSocket;
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: from, error: fromErr } = await supabase
  .from('vehicles').select('id,name').eq('name', FROM_NAME).single();
if (fromErr) throw fromErr;

const { data: moving, error: selErr } = await supabase
  .from('photos').select('id,storage_path,thumbnail_path,location_taken')
  .eq('vehicle_id', from.id).eq('location_taken', LOCATION).order('storage_path');
if (selErr) throw selErr;

console.log(`${moving.length} photo(s) at "${LOCATION}" currently on ${FROM_NAME}`);
if (!moving.length) { console.log('nothing to do'); process.exit(0); }

// Never touch storage until the originals are confirmed on disk — a re-upload
// has to remain possible if anything here goes wrong.
let missing = 0;
for (const r of moving) {
  const base = path.basename(r.storage_path);
  if (!existsSync(path.join(SRC_DIR, base))) { console.error(`  ! source missing: ${base}`); missing += 1; }
}
if (missing) {
  console.error(`\nABORT: ${missing} source file(s) not found under ${SRC_DIR}.`);
  console.error('Restore them before re-running; this script will not move storage it cannot rebuild.');
  process.exit(1);
}
console.log(`all ${moving.length} source file(s) confirmed on disk\n`);

let target;
{
  const { data: existing } = await supabase
    .from('vehicles').select('id').eq('name', TO_NAME).maybeSingle();
  if (existing) { target = existing.id; console.log(`${TO_NAME} row exists (${target})`); }
  else if (DRY) { target = '(dry-run)'; console.log(`${TO_NAME} row would be created`); }
  else {
    const { data, error } = await supabase.from('vehicles')
      .insert({ name: TO_NAME, type: 'tank', era: 'cold_war', nation: 'USSR' })
      .select('id').single();
    if (error) throw error;
    target = data.id;
    console.log(`created ${TO_NAME} row (${target})`);
  }
}

const retarget = (p) => p.replace('/t-72/', '/t-64/');
let moved = 0, failed = 0;

for (const r of moving) {
  const newPath = retarget(r.storage_path);
  const newThumb = r.thumbnail_path ? retarget(r.thumbnail_path) : null;

  if (DRY) {
    console.log(`  [dry] ${r.storage_path}\n        -> ${newPath}`);
    moved += 1;
    continue;
  }

  try {
    for (const [oldP, newP] of [[r.storage_path, newPath], [r.thumbnail_path, newThumb]]) {
      if (!oldP || oldP === newP) continue;
      const { error } = await supabase.storage.from(BUCKET).move(oldP, newP);
      // An already-moved object (from a partial earlier run) is not a failure.
      if (error && !/not found/i.test(error.message)) throw error;
    }
    const { error: updErr } = await supabase.from('photos')
      .update({ vehicle_id: target, storage_path: newPath, thumbnail_path: newThumb })
      .eq('id', r.id);
    if (updErr) throw updErr;
    console.log(`  + ${path.basename(newPath)} -> ${TO_NAME}`);
    moved += 1;
  } catch (e) {
    console.error(`  x ${r.storage_path}: ${e.message ?? e}`);
    failed += 1;
  }
}

const { data: leftover } = await supabase
  .from('photos').select('location_taken').eq('vehicle_id', from.id);
console.log(`\n${DRY ? 'DRY RUN — nothing written.' : 'Done.'} moved: ${moved}, failed: ${failed}`);
console.log(`${FROM_NAME} still holds ${leftover?.length ?? '?'} photo(s): ` +
            `${[...new Set((leftover ?? []).map((r) => r.location_taken))].join(', ')}`);
