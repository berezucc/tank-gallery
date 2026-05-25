import { VEHICLE_ERAS, VEHICLE_TYPES } from './constants';
import type { VehicleEra, VehicleType } from '@/types';

export interface Classification {
  name: string;
  type: VehicleType;
  era: VehicleEra;
  nation: string;
  confidence: 'high' | 'medium' | 'low';
  existing_match?: string;
}

export interface GalleryVehicleRef {
  id: string;
  name: string;
  type: VehicleType;
  era: VehicleEra;
  nation: string | null;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.2-90b-vision-preview';

const BASIC_PROMPT = `You are a military vehicle identification expert. Identify the military vehicle in this photo.

You MUST respond with ONLY a JSON object (no markdown, no code fences, no extra text):
{
  "name": "specific model name (e.g. M4 Sherman, T-34/85, Bf 109)",
  "type": "tank|aircraft|artillery|vehicle|other",
  "era": "ww1|ww2|cold_war|modern|other",
  "nation": "country of origin (e.g. USA, USSR/Russia, Germany, UK, Canada)",
  "confidence": "high|medium|low"
}

If the photo does NOT contain a military vehicle, set type to "other" and confidence to "low".`;

function buildContextPrompt(vehicles: GalleryVehicleRef[]): string {
  const catalog = vehicles
    .map((v) => `  - "${v.name}" (${v.type}, ${v.era}${v.nation ? `, ${v.nation}` : ''}) [id:${v.id}]`)
    .join('\n');

  return `You are a military vehicle identification expert. You have access to an existing gallery catalog.

EXISTING VEHICLES IN THE GALLERY:
${catalog}

Given this photo, determine:
1. Does this photo show a vehicle that ALREADY EXISTS in the catalog above? If so, return its ID in existing_match.
2. If it's a NEW vehicle not in the catalog, set existing_match to "".

Match by specific model — different variants (e.g. M4A3E8 vs M4 Sherman) are still the same vehicle unless listed separately. Use the EXACT name from the catalog when matching.

You MUST respond with ONLY a JSON object (no markdown, no code fences, no extra text):
{
  "existing_match": "vehicle-id-from-catalog or empty string if new",
  "name": "vehicle name (use catalog name if matching)",
  "type": "tank|aircraft|artillery|vehicle|other",
  "era": "ww1|ww2|cold_war|modern|other",
  "nation": "country of origin",
  "confidence": "high|medium|low"
}

If the photo does NOT contain a military vehicle, set type to "other", existing_match to "", and confidence to "low".`;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const braced = text.match(/\{[\s\S]*\}/);
  if (braced) return braced[0];
  return text.trim();
}

async function callGroq(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string,
  includeMatchField: boolean
): Promise<Classification> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => res.statusText);
    throw new Error(`Groq API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Groq');

  const parsed = JSON.parse(extractJson(raw));

  const result: Classification = {
    name:       String(parsed.name ?? '').trim(),
    type:       (VEHICLE_TYPES as readonly string[]).includes(parsed.type) ? parsed.type : 'other',
    era:        (VEHICLE_ERAS  as readonly string[]).includes(parsed.era)  ? parsed.era  : 'other',
    nation:     String(parsed.nation ?? '').trim(),
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
  };

  if (
    includeMatchField &&
    parsed.existing_match &&
    typeof parsed.existing_match === 'string' &&
    parsed.existing_match.length > 10
  ) {
    result.existing_match = parsed.existing_match;
  }

  return result;
}

export async function classifyVehicleImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<Classification> {
  return callGroq(imageBuffer, mimeType, BASIC_PROMPT, false);
}

export async function classifyWithGalleryContext(
  imageBuffer: Buffer,
  mimeType: string,
  vehicles: GalleryVehicleRef[]
): Promise<Classification> {
  return callGroq(imageBuffer, mimeType, buildContextPrompt(vehicles), true);
}
