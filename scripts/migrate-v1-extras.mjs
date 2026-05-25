// Pick up files in the v1 Tanks/ directory that weren't on the gallery page
// and so were missed by migrate-v1.mjs. One-shot; safe to re-run (idempotent
// via storage upsert + presence check before inserting photo row).
//
//   node --env-file=.env.local scripts/migrate-v1-extras.mjs

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';

const BASE = 'https://tank-gallery.netlify.app/Tanks/';

// (file, target_vehicle_name) — null target means "create a new Unidentified vehicle"
const EXTRAS = [
  { file: 'm4crab.jpg',   targetVehicleName: 'M4 Sherman Crab' },
  { file: 't3485.jpeg',   targetVehicleName: 'T-34-85' },
  { file: 'IMG_1311.JPG', targetVehicleName: null }, // unknown — create new
];

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

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function processImage(buf) {
  const meta = await sharp(buf).metadata();
  const thumb = await sharp(buf)
    .resize(400, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const { data: pixels, info } = await sharp(buf)
    .raw().ensureAlpha().resize(32, 32, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(pixels), info.width, info.height, 4, 4);
  return { thumb, blurhash, width: meta.width, height: meta.height };
}

let ok = 0, skipped = 0, fail = 0;

for (const e of EXTRAS) {
  try {
    // 1. Resolve target vehicle (existing or new)
    let vehicleId;
    if (e.targetVehicleName) {
      const { data: v } = await supabase
        .from('vehicles')
        .select('id')
        .eq('name', e.targetVehicleName)
        .maybeSingle();
      if (!v) {
        console.error(`✗ ${e.file}: target vehicle "${e.targetVehicleName}" not found`);
        fail += 1;
        continue;
      }
      vehicleId = v.id;
    } else {
      // Create an "Unidentified vehicle from v1: <filename>"
      const placeholderName = `Unidentified (${e.file})`;
      const { data: newV, error: vErr } = await supabase
        .from('vehicles')
        .insert({ name: placeholderName, type: 'other', era: 'other', nation: null })
        .select()
        .single();
      if (vErr) throw vErr;
      vehicleId = newV.id;
      console.log(`+ created placeholder vehicle: ${placeholderName}`);
    }

    // 2. Compute storage path; skip if photo already exists
    const ext  = (e.file.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const base = slugify(e.file.replace(/\.[^.]+$/, ''));
    const path  = `v1/${base}.${ext}`;
    const thumbPath = `v1/thumbs/${base}.webp`;

    const { data: existing } = await supabase
      .from('photos')
      .select('id')
      .eq('storage_path', path)
      .maybeSingle();
    if (existing) {
      console.log(`· ${e.file} already imported, skipping`);
      skipped += 1;
      continue;
    }

    // 3. Download → process → upload
    const res = await fetch(BASE + encodeURI(e.file));
    if (!res.ok) throw new Error(`download ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    const processed = await processImage(buf);

    const [oRes, tRes] = await Promise.all([
      supabase.storage.from('photos').upload(path,      buf,             { contentType: `image/${ext}`, upsert: true }),
      supabase.storage.from('photos').upload(thumbPath, processed.thumb, { contentType: 'image/webp',   upsert: true }),
    ]);
    if (oRes.error || tRes.error) throw oRes.error ?? tRes.error;

    // 4. Compute next sort_order so it appends to the vehicle's carousel
    const { data: lastPhoto } = await supabase
      .from('photos')
      .select('sort_order')
      .eq('vehicle_id', vehicleId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = (lastPhoto?.sort_order ?? -1) + 1;

    const { error: pErr } = await supabase
      .from('photos')
      .insert({
        vehicle_id:     vehicleId,
        storage_path:   path,
        thumbnail_path: thumbPath,
        blurhash:       processed.blurhash,
        width:          processed.width,
        height:         processed.height,
        sort_order:     sortOrder,
        ai_raw_response: { source: 'manual_v1' },
      });
    if (pErr) throw pErr;

    console.log(`✓ ${e.file} → ${e.targetVehicleName ?? 'new placeholder'}`);
    ok += 1;
  } catch (err) {
    console.error(`✗ ${e.file}: ${err.message ?? err}`);
    fail += 1;
  }
}

console.log(`\nDone. ${ok} added, ${skipped} already present, ${fail} failed.`);
console.log('Skipped: T-72.mp4 (video files not supported by gallery).');
