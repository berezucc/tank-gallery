import { Suspense } from 'react';
import Link from 'next/link';
import { getGalleryVehicles, getGalleryTotalCount } from '@/lib/supabase/queries';
import { FilterBar } from '@/components/gallery/FilterBar';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import { GalleryViews } from '@/components/gallery/GalleryViews';
import { ViewProvider } from '@/components/gallery/ViewProvider';
import { LightboxProvider } from '@/components/gallery/LightboxProvider';
import { VEHICLE_TYPES, VEHICLE_ERAS, } from '@/lib/constants';
import { GALLERY_VIEWS } from '@/types';
import type {
  GalleryFilters, VehicleType, VehicleEra, PhotoCard, PhotoGroup,
  LightboxEntry, GalleryView, TimelineVisit,
} from '@/types';
import type { MapPhoto } from '@/lib/supabase/queries';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseFilters(raw: Record<string, string | undefined>): GalleryFilters {
  const filters: GalleryFilters = {};
  if (raw.era    && (VEHICLE_ERAS  as readonly string[]).includes(raw.era))   filters.era    = raw.era as VehicleEra;
  if (raw.type   && (VEHICLE_TYPES as readonly string[]).includes(raw.type))  filters.type   = raw.type as VehicleType;
  if (raw.nation) filters.nation = raw.nation;
  if (raw.q)      filters.q      = raw.q.trim();
  return filters;
}

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// Cluster photos into "visits": one location, one month. This is what turns a
// flat wall of photos into a sequence of trips.
function buildVisits(cards: PhotoCard[]): TimelineVisit[] {
  const map = new Map<string, TimelineVisit>();

  for (const { photo, vehicle } of cards) {
    const month = photo.date_taken ? photo.date_taken.slice(0, 7) : '';
    const key = `${photo.location_taken ?? ''}|${month}`;
    let visit = map.get(key);

    if (!visit) {
      visit = {
        key,
        location: photo.location_taken,
        dateLabel: month ? MONTH_FMT.format(new Date(`${month}-01T00:00:00Z`)) : 'Date unknown',
        // Undated visits sort last rather than to 1970.
        sortKey: month ? Date.parse(`${month}-01T00:00:00Z`) : -Infinity,
        photos: [],
      };
      map.set(key, visit);
    }

    visit.photos.push({
      id: photo.id,
      storage_path: photo.storage_path,
      thumbnail_path: photo.thumbnail_path,
      width: photo.width,
      height: photo.height,
      vehicle_name: vehicle.name,
      vehicle_type: vehicle.type,
      vehicle_era: vehicle.era,
      vehicle_nation: vehicle.nation,
    });
  }

  return Array.from(map.values()).sort((a, b) => b.sortKey - a.sortKey);
}

function buildMapPhotos(cards: PhotoCard[]): MapPhoto[] {
  return cards
    .filter((c) => c.photo.lat != null && c.photo.lng != null)
    .map(({ photo, vehicle }) => ({
      id: photo.id,
      vehicle_id: vehicle.id,
      vehicle_name: vehicle.name,
      storage_path: photo.storage_path,
      thumbnail_path: photo.thumbnail_path,
      location_taken: photo.location_taken,
      lat: photo.lat as number,
      lng: photo.lng as number,
    }));
}

function groupPhotos(cards: PhotoCard[]): PhotoGroup[] {
  const map = new Map<string, PhotoGroup>();
  for (const c of cards) {
    // Group by vehicle NAME + location (not ID) so duplicate vehicle rows
    // with the same name still merge into one gallery card.
    const key = `${c.vehicle.name}|${c.photo.location_taken ?? ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.photos.push(c.photo);
    } else {
      map.set(key, {
        vehicle:  c.vehicle,
        photos:   [c.photo],
        location: c.photo.location_taken,
      });
    }
  }
  return Array.from(map.values());
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
  const vehicles = await getGalleryVehicles(filters);
  const isFiltered = Boolean(filters.era || filters.type || filters.nation || filters.q);

  const cards: PhotoCard[] = vehicles.flatMap((v) =>
    v.photos.map((p) => ({
      photo: p,
      vehicle: { id: v.id, name: v.name, type: v.type, era: v.era, nation: v.nation, created_at: v.created_at },
    }))
  );

  const groups = groupPhotos(cards);
  const totalPhotoCount = cards.length;
  const unfilteredTotal = isFiltered ? await getGalleryTotalCount() : totalPhotoCount;

  const nationSet = new Set<string>();
  vehicles.forEach((v) => v.nation && nationSet.add(v.nation));
  if (flat.nation) nationSet.add(flat.nation);
  const availableNations = Array.from(nationSet).sort();

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

  return (
    <main className="mx-auto max-w-[1800px] px-4 pb-12 pt-5 sm:px-6">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Tank Gallery</h1>
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
          <FilterBar availableNations={availableNations} />
        </Suspense>

        <LightboxProvider initialEntry={initialEntry} initialIndex={initialIndex}>
          <GalleryViews
            grid={<GalleryGrid groups={groups} />}
            mapPhotos={buildMapPhotos(cards)}
            visits={buildVisits(cards)}
          />
        </LightboxProvider>
      </ViewProvider>
    </main>
  );
}
