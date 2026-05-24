import { GoogleGenAI, Type } from '@google/genai';
import { VEHICLE_ERAS, VEHICLE_TYPES } from './constants';
import type { VehicleEra, VehicleType } from '@/types';

export interface Classification {
  name: string;
  type: VehicleType;
  era: VehicleEra;
  nation: string;
  confidence: 'high' | 'medium' | 'low';
}

const PROMPT = `You are a military vehicle identification expert. Identify the military vehicle in this photo.

Return a single JSON object with:
- name: the specific model name in common English usage (e.g. "M4 Sherman", "T-34/85", "Bf 109", "P-51 Mustang"). If uncertain, return a more generic name like "Soviet medium tank".
- type: the broad category
- era: the historical period
- nation: country of origin in short form (e.g. "USA", "USSR/Russia", "Germany", "UK", "Japan", "Canada", "France", "Italy")
- confidence: how confident you are in this identification

If the photo does NOT contain a military vehicle, set type to "other", name to a brief description of what is shown, and confidence to "low".`;

export async function classifyVehicleImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<Classification> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPT },
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString('base64'),
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name:   { type: Type.STRING },
          type:   { type: Type.STRING, enum: [...VEHICLE_TYPES] },
          era:    { type: Type.STRING, enum: [...VEHICLE_ERAS] },
          nation: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: ['name', 'type', 'era', 'nation', 'confidence'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty response from Gemini');

  const parsed = JSON.parse(text);
  return {
    name:       String(parsed.name ?? '').trim(),
    type:       (VEHICLE_TYPES as readonly string[]).includes(parsed.type) ? parsed.type : 'other',
    era:        (VEHICLE_ERAS  as readonly string[]).includes(parsed.era)  ? parsed.era  : 'other',
    nation:     String(parsed.nation ?? '').trim(),
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
  };
}
