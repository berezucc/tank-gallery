import { NextResponse } from 'next/server';
import { classifyVehicleImage } from '@/lib/gemini';

// Body: multipart/form-data with a single `file` field.
// Returns: { name, type, era, nation, confidence }
//
// PUBLIC endpoint — used by both the admin upload flow and the /identify page.
// Cost note: each call consumes one Gemini request. Free tier is 250/day, so
// a public route is theoretically abusable. The 5MB file cap + browser-side
// throttling keep casual abuse in check; for real public deploys, add IP rate
// limiting (e.g. Upstash Redis) before exposing widely.
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB > 5MB)` },
      { status: 413 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  try {
    const result = await classifyVehicleImage(buf, file.type || 'image/jpeg');
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Classification failed' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;
