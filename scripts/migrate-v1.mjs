// One-shot migration from tank-gallery.netlify.app.
// Downloads 58 photos (41 unique vehicles), processes each, uploads to Supabase,
// inserts vehicle + photo rows. After running, you can run bulk-classify.mjs
// to refine the metadata via Gemini.
//
// Run with:
//   node --env-file=.env.local scripts/migrate-v1.mjs
//   node --env-file=.env.local scripts/migrate-v1.mjs --skip-existing  # idempotent re-runs
//
// Original storage paths are preserved as v1/<slug>.<ext>.

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';

const BASE = 'https://tank-gallery.netlify.app/Tanks/';
const skipExisting = process.argv.includes('--skip-existing');

// Vehicle list, grouped — files[] becomes multiple photos pointing at one vehicle row.
// type/era reflect best guesses from the old site categorization; bulk-classify
// will refine these (especially nation, which is unset here).
const V1 = [
  // WW1
  { name: 'M1917',                   type: 'tank',      era: 'ww1', files: ['m1917.JPEG'] },
  { name: '7.7-cm Feldkanone 16',    type: 'artillery', era: 'ww1', files: ['7.7feldkanone.jpeg'] },
  { name: '15-cm Feldkanone L/40',   type: 'artillery', era: 'ww1', files: ['15feldkanone.jpg'] },
  { name: '15-cm Feldkanone L/45',   type: 'artillery', era: 'ww1', files: ['15felkanone45.jpeg'] },

  // WW2
  { name: 'M24 Chaffee',             type: 'tank',      era: 'ww2', files: ['chaffee.JPEG', 'chaffee.JPG'] },
  { name: 'M5 Stuart',               type: 'tank',      era: 'ww2', files: ['m5.jpg'] },
  { name: 'M3 Lee',                  type: 'tank',      era: 'ww2', files: ['m3lee.JPG', 'm3lee (2).JPG'] },
  { name: 'M4 Sherman',              type: 'tank',      era: 'ww2', files: ['m4.JPG', 'm4 (2).JPG'] },
  { name: 'M4 Sherman Crab',         type: 'tank',      era: 'ww2', files: ['crab.JPG'] },
  { name: 'Sherman Firefly',         type: 'tank',      era: 'ww2', files: ['firefly.JPG'] },
  { name: 'Ram II',                  type: 'tank',      era: 'ww2', files: ['ram2.jpg'] },
  { name: 'Matilda II',              type: 'tank',      era: 'ww2', files: ['matilda.jpg'] },
  { name: 'Valentine',               type: 'tank',      era: 'ww2', files: ['valentine.jpg', 'valentine (2).JPG'] },
  { name: 'Churchill',               type: 'tank',      era: 'ww2', files: ['churchill.jpg', 'churchill (2).JPG', 'churchill (3).JPG'] },
  { name: 'Sexton',                  type: 'artillery', era: 'ww2', files: ['sexton.jpg'] },
  { name: 'Ferret',                  type: 'vehicle',   era: 'ww2', files: ['ferret.JPG'] },
  { name: 'T-34-85',                 type: 'tank',      era: 'ww2', files: ['t3485.jpg', 't3485 (2).JPG'] },
  { name: 'M 14/41',                 type: 'tank',      era: 'ww2', files: ['m1441.jpg'] },
  { name: 'Panzer II',               type: 'tank',      era: 'ww2', files: ['pz2.JPG'] },
  { name: 'Panther',                 type: 'tank',      era: 'ww2', files: ['panther.JPG'] },
  { name: 'Sturmgeschütz III',       type: 'tank',      era: 'ww2', files: ['stug3.JPG'] },
  { name: 'Hetzer',                  type: 'tank',      era: 'ww2', files: ['hetzer.jpg'] },
  { name: 'Jagdpanzer IV',           type: 'tank',      era: 'ww2', files: ['jgd4.JPG'] },
  { name: 'Wirbelwind',              type: 'tank',      era: 'ww2', files: ['wirblewind.jpg'] },
  { name: '8.8 cm KwK 36',           type: 'artillery', era: 'ww2', files: ['tigergun.jpg'] },

  // Cold War
  { name: 'Centurion',               type: 'tank',      era: 'cold_war', files: ['centurion.JPG', 'centurion (2).JPG'] },
  { name: 'Chieftain Mk. 10',        type: 'tank',      era: 'cold_war', files: ['chieftan.JPG'] },
  { name: 'Leopard C1',              type: 'tank',      era: 'cold_war', files: ['leopard1.jpg'] },
  { name: 'Leopard C2',              type: 'tank',      era: 'cold_war', files: ['leopard1 (2).JPG'] },
  { name: 'CVR(T) Sabre',            type: 'vehicle',   era: 'cold_war', files: ['sabre.JPG'] },
  { name: 'LAV III',                 type: 'vehicle',   era: 'cold_war', files: ['lav.jpg', 'lav (2).JPG', 'lav(3).jpg'] },
  { name: 'M60A3',                   type: 'tank',      era: 'cold_war', files: ['m60.jpg', 'm60 (2).JPG', 'm60 (3).JPG'] },
  { name: 'M109 Paladin',            type: 'artillery', era: 'cold_war', files: ['m109.JPG'] },
  { name: 'M577A3',                  type: 'vehicle',   era: 'cold_war', files: ['m577a3.JPG'] },
  { name: 'M113',                    type: 'vehicle',   era: 'cold_war', files: ['m1113.JPG', 'm1113 (2).JPG'] },
  { name: 'M551 Sheridan',           type: 'tank',      era: 'cold_war', files: ['sheridan.jpeg', 'sheridan.JPG'] },
  { name: 'T-55',                    type: 'tank',      era: 'cold_war', files: ['t55.jpg'] },
  { name: 'TR-85',                   type: 'tank',      era: 'cold_war', files: ['tr85.JPEG'] },
  { name: 'T-72',                    type: 'tank',      era: 'cold_war', files: ['t72.jpg', 't72 (2).JPG'] },

  // Aircraft (filed under Cold War era)
  { name: 'F-86 Sabre',              type: 'aircraft',  era: 'cold_war', files: ['f86.jpg', 'f86 (2).JPG'] },
  { name: 'MiG-15',                  type: 'aircraft',  era: 'cold_war', files: ['mig15.jpeg'] },
  { name: 'CF-116',                  type: 'aircraft',  era: 'cold_war', files: ['CF-116.jpg'] },
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

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function processOne(buf) {
  const meta = await sharp(buf).metadata();
  const thumbnail = await sharp(buf)
    .resize(400, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const { data: pixels, info } = await sharp(buf)
    .raw().ensureAlpha().resize(32, 32, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(pixels), info.width, info.height, 4, 4);
  return { thumbnail, blurhash, width: meta.width, height: meta.height };
}

let okVehicles = 0, okPhotos = 0, failed = 0;

for (const v of V1) {
  // Check for existing if --skip-existing
  if (skipExisting) {
    const { data: existing } = await supabase
      .from('vehicles')
      .select('id')
      .eq('name', v.name)
      .maybeSingle();
    if (existing) {
      console.log(`· skipping ${v.name} (already exists)`);
      continue;
    }
  }

  const { data: vehicle, error: vErr } = await supabase
    .from('vehicles')
    .insert({ name: v.name, type: v.type, era: v.era, nation: null })
    .select()
    .single();
  if (vErr || !vehicle) {
    console.error(`✗ ${v.name}: ${vErr?.message}`);
    failed += 1;
    continue;
  }
  okVehicles += 1;
  console.log(`▸ ${v.name}`);

  for (let i = 0; i < v.files.length; i++) {
    const file = v.files[i];
    try {
      const remoteUrl = BASE + encodeURI(file);
      const res = await fetch(remoteUrl);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());

      const processed = await processOne(buf);

      const ext = (file.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const baseName = slugify(file.replace(/\.[^.]+$/, '')) || crypto.randomUUID();
      const originalPath  = `v1/${baseName}-${i}.${ext}`;
      const thumbnailPath = `v1/thumbs/${baseName}-${i}.webp`;

      const [oRes, tRes] = await Promise.all([
        supabase.storage.from('photos').upload(originalPath,  buf,                 { contentType: `image/${ext}`, upsert: true }),
        supabase.storage.from('photos').upload(thumbnailPath, processed.thumbnail, { contentType: 'image/webp',   upsert: true }),
      ]);
      if (oRes.error || tRes.error) throw oRes.error ?? tRes.error;

      const { error: pErr } = await supabase.from('photos').insert({
        vehicle_id:     vehicle.id,
        storage_path:   originalPath,
        thumbnail_path: thumbnailPath,
        blurhash:       processed.blurhash,
        width:          processed.width,
        height:         processed.height,
        sort_order:     i,
      });
      if (pErr) throw pErr;

      okPhotos += 1;
      console.log(`    ${i + 1}/${v.files.length}  ${file}`);
    } catch (e) {
      console.error(`    ✗ ${file}: ${e.message ?? e}`);
      failed += 1;
    }
  }
}

console.log(`\nDone. ${okVehicles} vehicles, ${okPhotos} photos. ${failed} failure(s).`);
console.log('Run bulk-classify next to fill in nation + refine metadata via Gemini.');
