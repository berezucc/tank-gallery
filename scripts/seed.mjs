// Seed script: uploads 6 placeholder photos to Supabase Storage and inserts vehicle + photo rows.
// Run with:  node --env-file=.env.local scripts/seed.mjs
//
// Images come from picsum.photos so we have real bytes to render — they're not actual tanks,
// but the gallery grid doesn't care. Replace with real photos once the admin upload is built.

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

// Node 20 lacks native WebSocket; supabase-js initializes realtime in the constructor.
globalThis.WebSocket = WebSocket;

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED = [
  { name: 'M4 Sherman',   type: 'tank',      era: 'ww2',    nation: 'USA',         picsumId: 1043, location: 'Canadian War Museum, Ottawa' },
  { name: 'T-34',         type: 'tank',      era: 'ww2',    nation: 'USSR/Russia', picsumId: 1011, location: 'Kubinka Tank Museum' },
  { name: 'Tiger I',      type: 'tank',      era: 'ww2',    nation: 'Germany',     picsumId: 1015, location: 'Bovington Tank Museum' },
  { name: 'M1 Abrams',    type: 'tank',      era: 'modern', nation: 'USA',         picsumId: 1019, location: 'Fort Benning' },
  { name: 'P-51 Mustang', type: 'aircraft',  era: 'ww2',    nation: 'USA',         picsumId: 1021, location: 'Smithsonian Air & Space' },
  { name: 'Spitfire',     type: 'aircraft',  era: 'ww2',    nation: 'UK',          picsumId: 1025, location: 'RAF Museum, Hendon' },
];

const WIDTH = 1200;
const HEIGHT = 800;

let inserted = 0;

for (const v of SEED) {
  try {
    // 1. Download placeholder image
    const imgRes = await fetch(`https://picsum.photos/id/${v.picsumId}/${WIDTH}/${HEIGHT}`);
    if (!imgRes.ok) throw new Error(`fetch failed: ${imgRes.status}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());

    // 2. Compute blurhash from a 32x32 raw RGBA downsample
    const { data: pixels, info } = await sharp(buf)
      .raw().ensureAlpha().resize(32, 32, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });
    const blurhash = encode(new Uint8ClampedArray(pixels), info.width, info.height, 4, 4);

    // 3. Upload to storage
    const slug = v.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const path = `seed/${slug}-${Date.now()}.jpg`;

    const { error: upErr } = await supabase.storage
      .from('photos')
      .upload(path, buf, { contentType: 'image/jpeg', upsert: false });
    if (upErr) throw upErr;

    // 3. Insert vehicle row
    const { data: vehicle, error: vErr } = await supabase
      .from('vehicles')
      .insert({ name: v.name, type: v.type, era: v.era, nation: v.nation })
      .select()
      .single();
    if (vErr) throw vErr;

    // 4. Insert photo row
    const { error: pErr } = await supabase
      .from('photos')
      .insert({
        vehicle_id: vehicle.id,
        storage_path: path,
        blurhash,
        width: WIDTH,
        height: HEIGHT,
        location_taken: v.location,
        sort_order: 0,
      });
    if (pErr) throw pErr;

    inserted += 1;
    console.log(`✓ ${v.name}`);
  } catch (e) {
    console.error(`✗ ${v.name}:`, e.message ?? e);
  }
}

console.log(`\nDone. ${inserted}/${SEED.length} seeded.`);
