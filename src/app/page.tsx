import { Suspense } from 'react';
import Link from 'next/link';
import { getGalleryVehicles } from '@/lib/supabase/queries';
import { getGalleryTotalCount } from '@/lib/supabase/queries';
import { FilterBar } from '@/components/gallery/FilterBar';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import { Lightbox } from '@/components/gallery/Lightbox';
import { VEHICLE_TYPES, VEHICLE_ERAS } from '@/lib/constants';
import type { GalleryFilters, VehicleType, VehicleEra, PhotoCard } from '@/types';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseFilters(raw: Record<string, string | undefined>): GalleryFilters {
  const filters: GalleryFilters = {};
  if (raw.era    && (VEHICLE_ERAS  as readonly string[]).includes(raw.era))   filters.era    = raw.era as VehicleEra;
  if (raw.type   && (VEHICLE_TYPES as readonly string[]).includes(raw.type))  filters.type   = raw.type as VehicleType;
  if (raw.nation) filters.nation = raw.nation;
  if (raw.q)      filters.q      = raw.q.trim();
  return filters;
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }

  const filters  = parseFilters(flat);
  const vehicles = await getGalleryVehicles(filters);
  const isFiltered = Boolean(filters.era || filters.type || filters.nation || filters.q);

  const cards: PhotoCard[] = vehicles.flatMap((v) =>
    v.photos.map((p) => ({
      photo: p,
      vehicle: { id: v.id, name: v.name, type: v.type, era: v.era, nation: v.nation, created_at: v.created_at },
    }))
  );

  // Get unfiltered total for "X of Y" display
  const totalCount = isFiltered ? await getGalleryTotalCount() : cards.length;

  const nationSet = new Set<string>();
  vehicles.forEach((v) => v.nation && nationSet.add(v.nation));
  if (flat.nation) nationSet.add(flat.nation);
  const availableNations = Array.from(nationSet).sort();

  let lightboxCards: PhotoCard[] = [];
  let lightboxIndex = 0;
  if (flat.photo) {
    const clicked = cards.find((c) => c.photo.id === flat.photo);
    if (clicked) {
      lightboxCards = cards.filter(
        (c) =>
          c.vehicle.id === clicked.vehicle.id &&
          c.photo.location_taken === clicked.photo.location_taken
      );
      lightboxIndex = lightboxCards.findIndex((c) => c.photo.id === flat.photo);
      if (lightboxIndex < 0) lightboxIndex = 0;
    }
  }

  return (
    <main className="mx-auto max-w-[1800px] px-4 pb-12 pt-5 sm:px-6">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Tank Gallery</h1>
          <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
            {isFiltered
              ? `${cards.length} of ${totalCount} photos`
              : `${cards.length} photos`}
          </p>
        </div>
        <nav className="flex gap-5 text-xs text-zinc-500">
          <Link href="/map"      className="transition-colors hover:text-zinc-100">Map</Link>
          <Link href="/stats"    className="transition-colors hover:text-zinc-100">Stats</Link>
          <Link href="/identify" className="transition-colors hover:text-zinc-100">Identify</Link>
        </nav>
      </header>

      <Suspense fallback={null}>
        <FilterBar availableNations={availableNations} />
      </Suspense>

      <GalleryGrid cards={cards} searchParams={flat} />

      <Lightbox cards={lightboxCards} initialIndex={lightboxIndex} />
    </main>
  );
}
