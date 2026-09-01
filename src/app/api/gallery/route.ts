import { NextResponse } from 'next/server';
import { VEHICLE_ERAS, VEHICLE_TYPES } from '@/lib/constants';
import {
  GRID_CHUNK, buildMapPhotos, buildVisits, groupPhotos, loadCards, toGridCards,
} from '@/lib/gallery-data';
import type { GalleryFilters, VehicleEra, VehicleType } from '@/types';

// Serves the parts of the gallery the page no longer ships up front: later grid
// chunks as you scroll, and the map/timeline datasets on first switch. All three
// honour the same filters as the page, so a chunk fetched mid-scroll matches
// what the server rendered above it.

function parseFilters(p: URLSearchParams): GalleryFilters {
  const f: GalleryFilters = {};
  const era = p.get('era');
  const type = p.get('type');
  if (era && (VEHICLE_ERAS as readonly string[]).includes(era))   f.era = era as VehicleEra;
  if (type && (VEHICLE_TYPES as readonly string[]).includes(type)) f.type = type as VehicleType;
  const nation = p.get('nation');
  const location = p.get('location');
  const q = p.get('q');
  if (nation)   f.nation = nation;
  if (location) f.location = location;
  if (q)        f.q = q.trim();
  return f;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') ?? 'grid';
  const filters = parseFilters(url.searchParams);

  try {
    const cards = await loadCards(filters);

    if (kind === 'map')      return NextResponse.json({ mapPhotos: buildMapPhotos(cards) });
    if (kind === 'timeline') return NextResponse.json({ visits: buildVisits(cards) });

    const groups = groupPhotos(cards);
    // Clamp so a hand-edited offset/limit cannot ask for the whole table.
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
    const limit = Math.min(GRID_CHUNK * 2, Math.max(1, Number(url.searchParams.get('limit') ?? GRID_CHUNK) || GRID_CHUNK));

    return NextResponse.json({
      cards: await toGridCards(groups.slice(offset, offset + limit)),
      total: groups.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'gallery load failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
