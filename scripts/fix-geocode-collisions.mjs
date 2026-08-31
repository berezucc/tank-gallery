// Repair museums that geocode.mjs placed on the wrong point.
//
// geocode.mjs queries Nominatim with limit=1 and writes whatever comes back,
// with no check that the result resembles the query. When Nominatim could not
// resolve a site it returned a loose match instead of nothing, so several
// unrelated museums collapsed onto one coordinate: seven Ontario locations all
// landed on the Ontario Regiment Museum in Oshawa, and four more on a point
// near Gatineau. One Hanoi photo ended up in western Germany.
//
// Every coordinate below was re-queried against Nominatim with a country filter
// and accepted only when the returned display_name actually named the place —
// see the per-entry note. Locations whose photos carry genuine per-shot EXIF GPS
// (Imperial War Museum, Battleship New Jersey, …) are deliberately absent: their
// spread is real and must not be flattened.
//
// Run with:
//   node --env-file=.env.local scripts/fix-geocode-collisions.mjs --dry-run
//   node --env-file=.env.local scripts/fix-geocode-collisions.mjs

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const DRY = process.argv.includes('--dry-run');

const FIXES = [
  // location_taken                                  lat        lng        why this coordinate
  ['Canadian War Museum',                        45.4171,  -75.7169, 'Nominatim [museum] "Canadian War Museum, Vimy Place, LeBreton Flats, Ottawa"'],
  ['CFB Borden',                                 44.2744,  -79.9271, 'Nominatim [military] "CFB Borden, Adjala-Tosorontio, Simcoe County"'],
  ['CFB Trenton',                                44.1188,  -77.5368, 'Nominatim [base] "CFB Trenton, Old Highway 2, Quinte West"'],
  ['Georgina Military Museum, Keswick',          44.2779,  -79.4593, 'Nominatim [museum] "Georgina Military Museum, Woodbine Avenue, Keswick"'],
  ['Woodbridge Memorial Tower',                  43.7824,  -79.5941, 'Nominatim [park] "Woodbridge War Memorial Tower and Park, Vaughan"'],
  ['Royal Canadian Legion Branch 63, Collingwood', 44.5039, -80.2016, 'Nominatim [social_centre] "Royal Canadian Legion Hall, Ontario Street, Collingwood"'],
  ['Edenvale Aerodrome, Stayner',                44.4374,  -79.9644, 'Nominatim [aerodrome] "Edenvale Aerodrome, Highway 26, Clearview"'],
  ['Ontario Regiment Museum, Oshawa',            43.9168,  -78.8954, 'Nominatim [museum] "Ontario Regiment Museum, Stevenson Road North, Oshawa" — already correct for most rows, pinned here so the stragglers on the Gatineau point join them'],
  ['Bảo tàng Chiến thắng B-52',                  21.0450,  105.8412, 'the value six of this museum’s seven photos already carry; the seventh had drifted to 51.32, 6.10 (western Germany)'],

  // APPROXIMATE. Nominatim has no entry for this memorial under any phrasing
  // tried, so this is the North York district centroid, not the monument. Right
  // city, wrong street — but ~50km closer than the Oshawa point it replaces.
  ['Victoria Cross Memorial, North York',        43.7543,  -79.4491, 'APPROXIMATE — North York district centroid; the memorial itself is not in Nominatim'],
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

const km = (aLat, aLng, bLat, bLng) =>
  Math.hypot((aLat - bLat) * 111, (aLng - bLng) * 111 * Math.cos(aLat * Math.PI / 180));

let moved = 0, already = 0;

for (const [loc, lat, lng, why] of FIXES) {
  const { data: rows, error } = await supabase
    .from('photos').select('id, lat, lng').eq('location_taken', loc);
  if (error) { console.error(`✗ ${loc}: ${error.message}`); continue; }
  if (!rows.length) { console.log(`- ${loc}: no photos`); continue; }

  const stale = rows.filter((r) => r.lat === null || km(r.lat, r.lng, lat, lng) > 0.5);
  console.log(`\n${loc}`);
  console.log(`  -> ${lat}, ${lng}`);
  console.log(`  ${why}`);
  console.log(`  ${rows.length} photo(s); ${stale.length} need moving`);

  if (!stale.length) { already += rows.length; continue; }

  const worst = Math.max(...stale.map((r) => (r.lat === null ? Infinity : km(r.lat, r.lng, lat, lng))));
  console.log(`  furthest currently ${worst.toFixed(0)} km away`);

  if (DRY) { moved += stale.length; continue; }

  const { error: upErr } = await supabase
    .from('photos').update({ lat, lng }).in('id', stale.map((r) => r.id));
  if (upErr) { console.error(`  ✗ update failed: ${upErr.message}`); continue; }
  moved += stale.length;
}

console.log(`\n${DRY ? 'DRY RUN — nothing written.' : 'Done.'} moved: ${moved}, already correct: ${already}`);

// Re-assert the invariant that was broken: two different museums must never
// share a coordinate. Photos with per-shot EXIF are exempt — their spread means
// each site occupies many points, none of which collide across sites.
const { data: all } = await supabase
  .from('photos').select('lat,lng,location_taken').not('lat', 'is', null);

const byCoord = new Map();
for (const r of all) {
  const k = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
  if (!byCoord.has(k)) byCoord.set(k, new Set());
  byCoord.get(k).add(r.location_taken);
}

const collisions = [...byCoord.entries()].filter(([, locs]) => locs.size > 1);
if (collisions.length) {
  console.log('\nREMAINING COLLISIONS:');
  for (const [k, locs] of collisions) console.log(`  ${k} <- ${[...locs].join(' | ')}`);
} else {
  console.log('\nNo coordinate is shared by two different locations.');
}
