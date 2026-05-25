// Delete the 6 seed vehicles + their photos + storage objects.
// One-shot cleanup after the real v1 data has been imported.
//
//   node --env-file=.env.local scripts/cleanup-seed.mjs

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

globalThis.WebSocket = WebSocket;
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Find photos in the seed/ storage prefix
const { data: photos, error } = await supabase
  .from('photos')
  .select('id, vehicle_id, storage_path, thumbnail_path')
  .like('storage_path', 'seed/%');

if (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
}

if (!photos.length) {
  console.log('Nothing to clean up — no seed photos found.');
  process.exit(0);
}

const vehicleIds = Array.from(new Set(photos.map((p) => p.vehicle_id)));
const storagePaths = photos.flatMap((p) =>
  [p.storage_path, p.thumbnail_path].filter(Boolean)
);

console.log(`Found ${photos.length} seed photo(s) across ${vehicleIds.length} vehicle(s).`);

// Delete storage objects (best-effort)
const { error: stErr } = await supabase.storage.from('photos').remove(storagePaths);
if (stErr) console.warn('Storage cleanup warning:', stErr.message);

// Delete vehicles — photos cascade via FK
const { error: vErr } = await supabase
  .from('vehicles')
  .delete()
  .in('id', vehicleIds);

if (vErr) {
  console.error('Vehicle delete failed:', vErr.message);
  process.exit(1);
}

console.log(`✓ Removed ${vehicleIds.length} vehicle(s), ${photos.length} photo row(s), ${storagePaths.length} storage object(s).`);
