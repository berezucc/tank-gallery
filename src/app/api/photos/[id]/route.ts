import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { STORAGE_BUCKET } from '@/lib/constants';

// PATCH /api/photos/[id]
// Body (all optional): { location_taken?, date_taken? }
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();

  const patch: Record<string, unknown> = {};
  if (typeof body?.location_taken === 'string') patch.location_taken = body.location_taken.trim() || null;
  if (body?.location_taken === null)            patch.location_taken = null;
  if (typeof body?.date_taken === 'string')     patch.date_taken = body.date_taken || null;
  if (body?.date_taken === null)                patch.date_taken = null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('photos')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Deletes a photo row and removes its storage objects.
// Also deletes the parent vehicle if no other photos remain for it.
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;

  const { data: photo, error: fetchErr } = await supabase
    .from('photos')
    .select('id, vehicle_id, storage_path, thumbnail_path')
    .eq('id', id)
    .single();

  if (fetchErr || !photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  const pathsToRemove = [photo.storage_path];
  if (photo.thumbnail_path) pathsToRemove.push(photo.thumbnail_path);
  await supabase.storage.from(STORAGE_BUCKET).remove(pathsToRemove);

  const { error: delErr } = await supabase.from('photos').delete().eq('id', id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // If the parent vehicle has no other photos, delete it too.
  const { count } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('vehicle_id', photo.vehicle_id);

  if (count === 0) {
    await supabase.from('vehicles').delete().eq('id', photo.vehicle_id);
  }

  return NextResponse.json({ ok: true });
}
