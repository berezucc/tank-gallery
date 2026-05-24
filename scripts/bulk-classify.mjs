// Re-classify every photo in the DB via Gemini and update the parent vehicle row.
// Useful after a large import, or to refresh stale metadata.
//
// Run with:
//   node --env-file=.env.local scripts/bulk-classify.mjs              # all photos
//   node --env-file=.env.local scripts/bulk-classify.mjs --only-untagged  # skip already-classified
//
// Respects Gemini free-tier limits (10 RPM) by sleeping 6.5s between calls.

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';
import WebSocket from 'ws';

const VEHICLE_TYPES = ['tank', 'aircraft', 'artillery', 'vehicle', 'other'];
const VEHICLE_ERAS  = ['ww1', 'ww2', 'cold_war', 'modern', 'other'];

const STORAGE_BUCKET = 'photos';
const RATE_LIMIT_MS  = 6500;

const onlyUntagged = process.argv.includes('--only-untagged');

const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const gemKey = process.env.GEMINI_API_KEY;

if (!url || !key || !gemKey) {
  console.error('Missing one of: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY');
  process.exit(1);
}

globalThis.WebSocket = WebSocket;
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const ai = new GoogleGenAI({ apiKey: gemKey });

const PROMPT = `You are a military vehicle identification expert. Identify the military vehicle in this photo.

Return a single JSON object with:
- name: the specific model name in common English usage (e.g. "M4 Sherman", "T-34/85", "Bf 109", "P-51 Mustang"). If uncertain, return a more generic name like "Soviet medium tank".
- type: the broad category
- era: the historical period
- nation: country of origin in short form (e.g. "USA", "USSR/Russia", "Germany", "UK")
- confidence: how confident you are in this identification

If the photo does NOT contain a military vehicle, set type to "other", name to a brief description of what is shown, and confidence to "low".`;

async function classify(buf, mimeType) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { text: PROMPT },
        { inlineData: { mimeType, data: buf.toString('base64') } },
      ],
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name:   { type: Type.STRING },
          type:   { type: Type.STRING, enum: VEHICLE_TYPES },
          era:    { type: Type.STRING, enum: VEHICLE_ERAS },
          nation: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: ['name', 'type', 'era', 'nation', 'confidence'],
      },
    },
  });
  return JSON.parse(response.text);
}

let q = supabase
  .from('photos')
  .select('id, storage_path, ai_raw_response, vehicle_id, vehicle:vehicles(id, name, type, era, nation)')
  .order('created_at', { ascending: true });

if (onlyUntagged) q = q.is('ai_raw_response', null);

const { data: photos, error } = await q;
if (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
}

console.log(`Re-classifying ${photos.length} photo(s)…\n`);

let ok = 0;
let fail = 0;

for (let i = 0; i < photos.length; i++) {
  const p = photos[i];
  const label = `[${i + 1}/${photos.length}]`;
  try {
    const { data: file, error: dlErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(p.storage_path);
    if (dlErr) throw dlErr;

    const buf = Buffer.from(await file.arrayBuffer());
    const ai = await classify(buf, file.type || 'image/jpeg');

    // Update parent vehicle metadata
    const { error: vErr } = await supabase
      .from('vehicles')
      .update({
        name:   ai.name,
        type:   ai.type,
        era:    ai.era,
        nation: ai.nation || null,
      })
      .eq('id', p.vehicle_id);
    if (vErr) throw vErr;

    // Store raw AI response on the photo
    const { error: pErr } = await supabase
      .from('photos')
      .update({ ai_raw_response: ai })
      .eq('id', p.id);
    if (pErr) throw pErr;

    const wasName = p.vehicle?.name ?? '(none)';
    console.log(`${label} ✓ ${wasName} → ${ai.name} (${ai.confidence})`);
    ok += 1;
  } catch (e) {
    console.error(`${label} ✗ photo ${p.id}: ${e.message ?? e}`);
    fail += 1;
  }

  // Stay under 10 RPM
  if (i < photos.length - 1) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }
}

console.log(`\nDone. ${ok} ok, ${fail} failed.`);
