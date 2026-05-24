import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { VEHICLE_ERAS, VEHICLE_TYPES } from '@/lib/constants';

// PATCH /api/vehicles/[id]
// Body (all optional): { name?, type?, era?, nation? }
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
  if (typeof body?.name   === 'string') patch.name   = body.name.trim();
  if (typeof body?.nation === 'string') patch.nation = body.nation.trim() || null;
  if (body?.nation === null)            patch.nation = null;

  if (body?.type) {
    if (!(VEHICLE_TYPES as readonly string[]).includes(body.type)) {
      return NextResponse.json({ error: 'invalid type' }, { status: 400 });
    }
    patch.type = body.type;
  }
  if (body?.era) {
    if (!(VEHICLE_ERAS as readonly string[]).includes(body.era)) {
      return NextResponse.json({ error: 'invalid era' }, { status: 400 });
    }
    patch.era = body.era;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('vehicles')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
