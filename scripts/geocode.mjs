// Fill lat/lng on every photo whose location_taken is set but lat is null.
// Uses Nominatim (OpenStreetMap) — free, no API key, rate-limited to 1 req/sec
// per their usage policy. Caches results by location string so we don't re-query
// the same museum 5 times.
//
// Run with:
//   node --env-file=.env.local scripts/geocode.mjs

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'tank-gallery-v2/0.1 (personal project; contact via repo)';
const SLEEP_MS = 1100; // be polite

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

const { data: photos, error } = await supabase
  .from('photos')
  .select('id, location_taken')
  .not('location_taken', 'is', null)
  .is('lat', null);

if (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
}

if (!photos.length) {
  console.log('Nothing to geocode — all photos with a location already have coordinates.');
  process.exit(0);
}

// Group by location string
const byLocation = new Map();
for (const p of photos) {
  const loc = p.location_taken.trim();
  if (!byLocation.has(loc)) byLocation.set(loc, []);
  byLocation.get(loc).push(p.id);
}

console.log(`Geocoding ${byLocation.size} distinct location(s) across ${photos.length} photo(s)…\n`);

let ok = 0, fail = 0;
const cache = new Map();
const locations = Array.from(byLocation.keys());

for (let i = 0; i < locations.length; i++) {
  const loc = locations[i];
  const photoIds = byLocation.get(loc);
  const label = `[${i + 1}/${locations.length}]`;

  let coords = cache.get(loc);
  if (!coords) {
    try {
      const u = `${NOMINATIM}?q=${encodeURIComponent(loc)}&format=json&limit=1`;
      const res = await fetch(u, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.json();
      if (!arr.length) {
        console.log(`${label} ? "${loc}" — no results`);
        fail += 1;
        continue;
      }
      coords = { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
      cache.set(loc, coords);
    } catch (e) {
      console.error(`${label} ✗ "${loc}": ${e.message}`);
      fail += 1;
      continue;
    }
  }

  const { error: upErr } = await supabase
    .from('photos')
    .update({ lat: coords.lat, lng: coords.lng })
    .in('id', photoIds);

  if (upErr) {
    console.error(`${label} ✗ update failed for "${loc}": ${upErr.message}`);
    fail += 1;
  } else {
    console.log(`${label} ✓ "${loc}" → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} (${photoIds.length} photo${photoIds.length > 1 ? 's' : ''})`);
    ok += 1;
  }

  if (i < locations.length - 1) {
    await new Promise((r) => setTimeout(r, SLEEP_MS));
  }
}

console.log(`\nDone. ${ok} location(s) geocoded, ${fail} failure(s).`);
