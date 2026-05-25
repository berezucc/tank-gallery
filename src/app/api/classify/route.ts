import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { classifyVehicleImage, classifyWithGalleryContext } from '@/lib/classifier';
import type { GalleryVehicleRef } from '@/lib/classifier';

// Body: multipart/form-data with a single `file` field.
// Returns: { name, type, era, nation, confidence, existing_match? }
//
// When the caller is an authenticated admin, the classifier is enriched with
// the existing vehicle catalog — Gemini matches against known vehicles first,
// which is dramatically more accurate than open-ended guessing. For the public
// /identify page (no auth), uses the basic prompt with no gallery context.
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

  // Check if caller is an authenticated admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  try {
    let result;
    if (user) {
      // Admin: include gallery catalog for context-aware matching
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, name, type, era, nation')
        .returns<GalleryVehicleRef[]>();

      if (vehicles && vehicles.length > 0) {
        result = await classifyWithGalleryContext(buf, file.type || 'image/jpeg', vehicles);
      } else {
        result = await classifyVehicleImage(buf, file.type || 'image/jpeg');
      }
    } else {
      // Public: basic classification, no gallery data exposed
      result = await classifyVehicleImage(buf, file.type || 'image/jpeg');
    }

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
