import { Suspense } from 'react';
import Link from 'next/link';
import { getGalleryTotalCount, getLocationCounts } from '@/lib/supabase/queries';
import {
  GRID_CHUNK, groupPhotos, loadCards, toGridCards,
} from '@/lib/gallery-data';
import { FilterBar } from '@/components/gallery/FilterBar';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import { GalleryViews } from '@/components/gallery/GalleryViews';
import { ViewProvider } from '@/components/gallery/ViewProvider';
import { LightboxProvider } from '@/components/gallery/LightboxProvider';
import { VEHICLE_TYPES, VEHICLE_ERAS, } from '@/lib/constants';
import { GALLERY_VIEWS } from '@/types';
import type {
  GalleryFilters, VehicleType, VehicleEra, LightboxEntry, GalleryView,
} from '@/types';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseFilters(raw: Record<string, string | undefined>): GalleryFilters {
  const filters: GalleryFilters = {};
  if (raw.era    && (VEHICLE_ERAS  as readonly string[]).includes(raw.era))   filters.era    = raw.era as VehicleEra;
  if (raw.type   && (VEHICLE_TYPES as readonly string[]).includes(raw.type))  filters.type   = raw.type as VehicleType;
  if (raw.nation)   filters.nation   = raw.nation;
  if (raw.location) filters.location = raw.location;
  if (raw.q)        filters.q        = raw.q.trim();
  return filters;
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }

  const initialView: GalleryView =
    (GALLERY_VIEWS as readonly string[]).includes(flat.view ?? '')
      ? (flat.view as GalleryView)
      : 'grid';

  const filters  = parseFilters(flat);
  const [cards, locationCounts] = await Promise.all([
    loadCards(filters),
    getLocationCounts(),
  ]);
  const isFiltered = Boolean(
    filters.era || filters.type || filters.nation || filters.location || filters.q
  );

  const groups = groupPhotos(cards);
  // Only the first chunk is rendered; GalleryGrid fetches the rest on scroll.
  const initialCards = await toGridCards(groups.slice(0, GRID_CHUNK));
  const totalPhotoCount = cards.length;
  const unfilteredTotal = isFiltered ? await getGalleryTotalCount() : totalPhotoCount;

  const nationSet = new Set<string>();
  cards.forEach((c) => c.vehicle.nation && nationSet.add(c.vehicle.nation));
  if (flat.nation) nationSet.add(flat.nation);
  const availableNations = Array.from(nationSet).sort();

  // Built from the whole archive rather than the filtered result, so narrowing
  // to one museum doesn't collapse the menu to that single entry and strand you
  // there. Ordered by photo count, so the places you shot most sit at the top.
  const availableLocations = locationCounts.map((l) => ({ value: l.location, count: l.count }));

  // Only used for a ?photo=<id> deep link on first load. Ordinary clicks open
  // the lightbox from client state and never re-render this page.
  let initialEntry: LightboxEntry | null = null;
  let initialIndex = 0;
  if (flat.photo) {
    for (const g of groups) {
      const idx = g.photos.findIndex((p) => p.id === flat.photo);
      if (idx >= 0) {
        initialEntry = {
          vehicle: { name: g.vehicle.name, type: g.vehicle.type, era: g.vehicle.era, nation: g.vehicle.nation },
          photos: g.photos.map((p) => ({
            id: p.id,
            storage_path: p.storage_path,
            width: p.width,
            height: p.height,
            location_taken: p.location_taken,
          })),
        };
        initialIndex = idx;
        break;
      }
    }
  }

  // Forwarded to the client so /api/gallery returns rows consistent with these.
  const filterQuery = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v).map(([k, v]) => [k, String(v)])
  ).toString();

  return (
    <main className="mx-auto max-w-[1800px] px-4 pb-12 pt-5 sm:px-6">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Archive</h1>
          <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
            {isFiltered
              ? `${totalPhotoCount} of ${unfilteredTotal} photos`
              : `${totalPhotoCount} photos`}
          </p>
        </div>
        <nav className="flex gap-5 text-xs text-zinc-500">
          {/* Map lives in the view switcher now, so it's dropped from the nav. */}
          <Link href="/stats"    className="transition-colors hover:text-zinc-100">Stats</Link>
          <Link href="/museums"  className="transition-colors hover:text-zinc-100">Museums</Link>
          <Link href="/identify" className="transition-colors hover:text-zinc-100">Identify</Link>
        </nav>
      </header>

      {/* ViewProvider wraps both, so the switcher can live inside the toolbar
          while the content below reads the same view state. */}
      <ViewProvider initialView={initialView}>
        <Suspense fallback={null}>
          <FilterBar availableNations={availableNations} availableLocations={availableLocations} />
        </Suspense>

        <LightboxProvider initialEntry={initialEntry} initialIndex={initialIndex}>
          <GalleryViews
            query={filterQuery}
            grid={
              <GalleryGrid
                initial={initialCards}
                total={groups.length}
                query={filterQuery}
                chunk={GRID_CHUNK}
              />
            }
          />
        </LightboxProvider>
      </ViewProvider>
    </main>
  );
}
