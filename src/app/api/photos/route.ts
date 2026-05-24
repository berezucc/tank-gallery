import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { VEHICLE_ERAS, VEHICLE_TYPES } from '@/lib/constants';

// Body shape — one of:
//   { vehicle_id: <uuid>, photo: {...} }       attach photo to existing vehicle
//   { vehicle: { name, type, era, nation? }, photo: {...} }  create new vehicle
//
// In the existing-vehicle case the new photo's sort_order is set to (max + 1)
// so it lands at the end of the gallery's photo carousel.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const p = body?.photo;

  if (!p?.storage_path) {
    return NextResponse.json({ error: 'photo.storage_path is required' }, { status: 400 });
  }

  let vehicleId: string;
  let createdVehicleId: string | null = null;

  if (typeof body?.vehicle_id === 'string') {
    const { data: existing, error } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', body.vehicle_id)
      .single();
    if (error || !existing) {
      return NextResponse.json({ error: 'vehicle_id not found' }, { status: 400 });
    }
    vehicleId = existing.id;
  } else {
    const v = body?.vehicle;
    if (!v?.name || typeof v.name !== 'string') {
      return NextResponse.json({ error: 'vehicle.name or vehicle_id is required' }, { status: 400 });
    }
    if (v.type && !(VEHICLE_TYPES as readonly string[]).includes(v.type)) {
      return NextResponse.json({ error: 'invalid vehicle.type' }, { status: 400 });
    }
    if (v.era && !(VEHICLE_ERAS as readonly string[]).includes(v.era)) {
      return NextResponse.json({ error: 'invalid vehicle.era' }, { status: 400 });
    }

    const { data: created, error: vErr } = await supabase
      .from('vehicles')
      .insert({
        name:   v.name.trim(),
        type:   v.type   ?? 'other',
        era:    v.era    ?? 'other',
        nation: v.nation ? String(v.nation).trim() : null,
      })
      .select()
      .single();

    if (vErr || !created) {
      return NextResponse.json({ error: vErr?.message ?? 'Vehicle insert failed' }, { status: 500 });
    }
    vehicleId = created.id;
    createdVehicleId = created.id;
  }

  // Compute next sort_order for this vehicle
  const { data: existingPhotos } = await supabase
    .from('photos')
    .select('sort_order')
    .eq('vehicle_id', vehicleId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextSortOrder = (existingPhotos?.[0]?.sort_order ?? -1) + 1;

  const { data: photo, error: pErr } = await supabase
    .from('photos')
    .insert({
      vehicle_id:     vehicleId,
      storage_path:   p.storage_path,
      thumbnail_path: p.thumbnail_path ?? null,
      blurhash:       p.blurhash       ?? null,
      width:          p.width          ?? null,
      height:         p.height         ?? null,
      location_taken: p.location_taken ?? null,
      date_taken:     p.date_taken     ?? null,
      sort_order:     nextSortOrder,
    })
    .select()
    .single();

  if (pErr || !photo) {
    // Rollback the vehicle if we just created it.
    if (createdVehicleId) {
      await supabase.from('vehicles').delete().eq('id', createdVehicleId);
    }
    return NextResponse.json({ error: pErr?.message ?? 'Photo insert failed' }, { status: 500 });
  }

  return NextResponse.json({ vehicle_id: vehicleId, photo });
}
