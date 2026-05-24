import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { STORAGE_BUCKET } from '@/lib/constants';

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
