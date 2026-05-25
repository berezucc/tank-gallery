import { Suspense } from 'react';
import Link from 'next/link';
import { getGalleryVehicles } from '@/lib/supabase/queries';
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

  // Flatten to one card per photo.
  const cards: PhotoCard[] = vehicles.flatMap((v) =>
    v.photos.map((p) => ({
      photo: p,
      vehicle: { id: v.id, name: v.name, type: v.type, era: v.era, nation: v.nation, created_at: v.created_at },
    }))
  );

  const nationSet = new Set<string>();
  vehicles.forEach((v) => v.nation && nationSet.add(v.nation));
  if (flat.nation) nationSet.add(flat.nation);
  const availableNations = Array.from(nationSet).sort();

  // Find the clicked photo + its group (same vehicle + location + date) for the lightbox carousel.
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
    <main className="mx-auto max-w-screen-2xl px-6 pb-12 pt-6">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tank Gallery</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {cards.length} {cards.length === 1 ? 'photo' : 'photos'}
            {' · '}{vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'}
          </p>
        </div>
        <nav className="flex gap-4 text-sm text-zinc-400">
          <Link href="/map"      className="hover:text-zinc-100">Map</Link>
          <Link href="/stats"    className="hover:text-zinc-100">Stats</Link>
          <Link href="/identify" className="hover:text-zinc-100">Identify</Link>
        </nav>
      </header>

      <Suspense fallback={null}>
        <FilterBar availableNations={availableNations} />
      </Suspense>

      <GalleryGrid cards={cards} searchParams={flat} />

      <Lightbox
        cards={lightboxCards}
        initialIndex={lightboxIndex}
      />
    </main>
  );
}
