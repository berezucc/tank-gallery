// Fix EXIF orientation issues: re-generate thumbnails with correct rotation
// and update width/height in the DB to post-rotation values.
//
// Run with:  node --env-file=.env.local scripts/fix-orientation.mjs

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env vars'); process.exit(1); }

globalThis.WebSocket = WebSocket;
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: photos, error } = await supabase
  .from('photos')
  .select('id, storage_path, thumbnail_path, width, height')
  .order('created_at');

if (error || !photos) { console.error('Query failed:', error?.message); process.exit(1); }

console.log(`Checking ${photos.length} photo(s) for orientation issues…\n`);

let fixed = 0, skipped = 0, failed = 0;

for (let i = 0; i < photos.length; i++) {
  const p = photos[i];
  const label = `[${i + 1}/${photos.length}]`;

  try {
    // Download original
    const { data: file, error: dlErr } = await supabase.storage
      .from('photos')
      .download(p.storage_path);
    if (dlErr) throw dlErr;
    const buf = Buffer.from(await file.arrayBuffer());

    // Check EXIF orientation
    const meta = await sharp(buf).metadata();
    const needsRotation = meta.orientation && meta.orientation >= 5;

    // Compute correct post-rotation dimensions
    let correctW = meta.width;
    let correctH = meta.height;
    if (needsRotation) {
      correctW = meta.height;
      correctH = meta.width;
    }

    // Check if DB dimensions are wrong
    const dimsWrong = (p.width !== correctW || p.height !== correctH);

    if (!needsRotation && !dimsWrong) {
      skipped += 1;
      continue;
    }

    // Re-encode original with rotation baked into pixels (strips EXIF orientation)
    const rotated = sharp(buf).rotate();
    const ext = p.storage_path.split('.').pop()?.toLowerCase() || 'jpg';
    let rotatedOriginal;
    if (ext === 'png') {
      rotatedOriginal = await rotated.clone().png().toBuffer();
    } else {
      rotatedOriginal = await rotated.clone().jpeg({ quality: 92 }).toBuffer();
    }

    // Re-generate thumbnail
    const thumbnail = await rotated
      .clone()
      .resize(400, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // Re-generate blurhash
    const { data: pixels, info } = await rotated
      .clone()
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });
    const blurhash = encode(new Uint8ClampedArray(pixels), info.width, info.height, 4, 4);

    // Re-upload both original and thumbnail with rotation baked in
    await supabase.storage
      .from('photos')
      .upload(p.storage_path, rotatedOriginal, {
        contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        upsert: true,
      });

    if (p.thumbnail_path) {
      await supabase.storage
        .from('photos')
        .upload(p.thumbnail_path, thumbnail, {
          contentType: 'image/webp',
          upsert: true,
        });
    }

    // Update DB with correct dimensions + blurhash
    await supabase
      .from('photos')
      .update({
        width:    correctW,
        height:   correctH,
        blurhash: blurhash,
      })
      .eq('id', p.id);

    console.log(`${label} ✓ ${p.storage_path} — rotated (EXIF ${meta.orientation}), ${meta.width}x${meta.height} → ${correctW}x${correctH}`);
    fixed += 1;
  } catch (e) {
    console.error(`${label} ✗ ${p.storage_path}: ${e.message ?? e}`);
    failed += 1;
  }
}

console.log(`\nDone. ${fixed} fixed, ${skipped} already correct, ${failed} failed.`);
