import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/vehicles?q=<search>
// Returns the top 10 vehicles whose name matches the query (case-insensitive).
// Used by the admin upload form's "assign to existing vehicle" autocomplete.
//
// Auth-gated since this is only useful to the admin during uploads. RLS would
// allow public read anyway, but no point exposing the endpoint publicly.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const q   = url.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, name, type, era, nation')
    .ilike('name', `%${escaped}%`)
    .order('name')
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
