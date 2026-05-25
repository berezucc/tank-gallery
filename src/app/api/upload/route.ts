import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processImage } from '@/lib/images';
import { STORAGE_BUCKET } from '@/lib/constants';

// Body: multipart/form-data with a single `file` field.
// Returns: { storage_path, thumbnail_path, blurhash, width, height }
//
// Note: this only uploads bytes + returns metadata. The caller is responsible
// for posting to /api/photos with the chosen vehicle metadata to actually save
// a DB row. That two-step separation lets the admin tweak fields before commit.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to parse upload' },
      { status: 400 }
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  let processed;
  try {
    processed = await processImage(buf);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Image processing failed' },
      { status: 400 }
    );
  }

  const id   = crypto.randomUUID();
  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const originalPath  = `originals/${id}.${ext}`;
  const thumbnailPath = `thumbs/${id}.webp`;

  const [originalRes, thumbRes] = await Promise.all([
    supabase.storage.from(STORAGE_BUCKET).upload(originalPath, buf, {
      contentType: file.type || 'image/jpeg',
    }),
    supabase.storage.from(STORAGE_BUCKET).upload(thumbnailPath, processed.thumbnail, {
      contentType: 'image/webp',
    }),
  ]);

  if (originalRes.error || thumbRes.error) {
    return NextResponse.json(
      { error: originalRes.error?.message ?? thumbRes.error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    storage_path:   originalPath,
    thumbnail_path: thumbnailPath,
    blurhash:       processed.blurhash,
    width:          processed.width,
    height:         processed.height,
  });
}

// Tell Next.js this route handles potentially large uploads.
export const runtime = 'nodejs';
export const maxDuration = 30;
