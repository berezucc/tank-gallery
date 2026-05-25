import { GoogleGenAI, Type } from '@google/genai';
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

const BASIC_PROMPT = `You are a military vehicle identification expert. Identify the military vehicle in this photo.

Return a single JSON object with:
- name: the specific model name in common English usage (e.g. "M4 Sherman", "T-34/85", "Bf 109", "P-51 Mustang"). If uncertain, return a more generic name like "Soviet medium tank".
- type: the broad category
- era: the historical period
- nation: country of origin in short form (e.g. "USA", "USSR/Russia", "Germany", "UK", "Japan", "Canada", "France", "Italy")
- confidence: how confident you are in this identification

If the photo does NOT contain a military vehicle, set type to "other", name to a brief description of what is shown, and confidence to "low".`;

function buildContextPrompt(vehicles: GalleryVehicleRef[]): string {
  const catalog = vehicles
    .map((v) => `  • "${v.name}" (${v.type}, ${v.era}${v.nation ? `, ${v.nation}` : ''}) [id:${v.id}]`)
    .join('\n');

  return `You are a military vehicle identification expert. You have access to an existing gallery catalog.

EXISTING VEHICLES IN THE GALLERY:
${catalog}

Given this photo, determine:
1. Does this photo show a vehicle that ALREADY EXISTS in the catalog above? If so, return its ID in the existing_match field. Match by specific model — different variants (e.g. M4A3E8 "Easy Eight" vs plain M4 Sherman) are still the same vehicle UNLESS the gallery already has both variants listed separately.
2. If it's a NEW vehicle not in the catalog, set existing_match to "" and provide full classification.

Use the EXACT name from the catalog when matching an existing vehicle. Do not rename it.

Return JSON with:
- existing_match: the vehicle ID from the catalog (e.g. "abc-123") if it matches, or "" if this is a new vehicle
- name: the vehicle name (use the catalog name if matching, or a new name if not)
- type: the broad category
- era: the historical period
- nation: country of origin in short form
- confidence: how confident you are

If the photo does NOT contain a military vehicle, set type to "other", existing_match to "", and confidence to "low".`;
}

// Basic classification — no gallery context. Used by the public /identify page.
export async function classifyVehicleImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<Classification> {
  return callGemini(imageBuffer, mimeType, BASIC_PROMPT, false);
}

// Context-aware classification — includes existing vehicle catalog for matching.
// Used by admin upload flow. Much more accurate because Gemini discriminates
// against a known set instead of guessing from its full training data.
export async function classifyWithGalleryContext(
  imageBuffer: Buffer,
  mimeType: string,
  vehicles: GalleryVehicleRef[]
): Promise<Classification> {
  const prompt = buildContextPrompt(vehicles);
  return callGemini(imageBuffer, mimeType, prompt, true);
}

async function callGemini(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string,
  includeMatchField: boolean
): Promise<Classification> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const ai = new GoogleGenAI({ apiKey });

  const properties: Record<string, unknown> = {
    name:       { type: Type.STRING },
    type:       { type: Type.STRING, enum: [...VEHICLE_TYPES] },
    era:        { type: Type.STRING, enum: [...VEHICLE_ERAS] },
    nation:     { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
  };
  const required = ['name', 'type', 'era', 'nation', 'confidence'];

  if (includeMatchField) {
    properties.existing_match = { type: Type.STRING };
    required.push('existing_match');
  }

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: imageBuffer.toString('base64') } },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties,
        required,
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty response from Gemini');

  const parsed = JSON.parse(text);
  const result: Classification = {
    name:       String(parsed.name ?? '').trim(),
    type:       (VEHICLE_TYPES as readonly string[]).includes(parsed.type) ? parsed.type : 'other',
    era:        (VEHICLE_ERAS  as readonly string[]).includes(parsed.era)  ? parsed.era  : 'other',
    nation:     String(parsed.nation ?? '').trim(),
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
  };

  if (includeMatchField && parsed.existing_match && typeof parsed.existing_match === 'string' && parsed.existing_match.length > 10) {
    result.existing_match = parsed.existing_match;
  }

  return result;
}
