// Shared shaping for the gallery's three views.
//
// This used to live inside app/page.tsx, but the grid now loads in chunks and
// map/timeline load on demand, so a route handler needs to build exactly the
// same shapes the page does. Keeping one implementation means a filtered chunk
// fetched at scroll position 400 is grouped identically to the first chunk.

import { getGalleryVehicles } from './supabase/queries';
import { blurhashToDataUrl } from './blurhash';
import { publicPhotoUrl } from './storage';
import type { MapPhoto } from './supabase/queries';
import type {
  GalleryFilters, GridCard, PhotoCard, PhotoGroup, TimelineVisit,
} from '@/types';

/** Cards rendered before the first scroll. Roughly two screens on a laptop. */
export const GRID_CHUNK = 48;

const MONTH_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});

export async function loadCards(filters: GalleryFilters): Promise<PhotoCard[]> {
  const vehicles = await getGalleryVehicles(filters);
  return vehicles.flatMap((v) =>
    v.photos.map((p) => ({
      photo: p,
      vehicle: {
        id: v.id, name: v.name, type: v.type,
        era: v.era, nation: v.nation, created_at: v.created_at,
      },
    }))
  );
}

// Group by vehicle NAME + location (not ID) so duplicate vehicle rows with the
// same name still merge into one gallery card.
export function groupPhotos(cards: PhotoCard[]): PhotoGroup[] {
  const map = new Map<string, PhotoGroup>();
  for (const c of cards) {
    const key = `${c.vehicle.name}|${c.photo.location_taken ?? ''}`;
    const existing = map.get(key);
    if (existing) existing.photos.push(c.photo);
    else map.set(key, { vehicle: c.vehicle, photos: [c.photo], location: c.photo.location_taken });
  }
  return Array.from(map.values());
}

// Flatten a group into everything the card needs and nothing else. The blur
// placeholder is decoded here because it needs sharp, which cannot run in the
// browser — so appended chunks arrive with theirs already computed.
export async function toGridCards(groups: PhotoGroup[]): Promise<GridCard[]> {
  return Promise.all(
    groups.map(async (g) => {
      const hero = g.photos[0];
      return {
        key: `${g.vehicle.id}|${g.location ?? ''}`,
        heroUrl: publicPhotoUrl(hero.thumbnail_path ?? hero.storage_path),
        aspect: hero.width && hero.height ? hero.width / hero.height : 4 / 3,
        blurDataURL: await blurhashToDataUrl(hero.blurhash),
        count: g.photos.length,
        vehicleName: g.vehicle.name,
        nation: g.vehicle.nation,
        location: g.location,
        entry: {
          vehicle: {
            name: g.vehicle.name, type: g.vehicle.type,
            era: g.vehicle.era, nation: g.vehicle.nation,
          },
          photos: g.photos.map((p) => ({
            id: p.id,
            storage_path: p.storage_path,
            width: p.width,
            height: p.height,
            location_taken: p.location_taken,
          })),
        },
      };
    })
  );
}

// Cluster photos into "visits": one location, one month. This is what turns a
// flat wall of photos into a sequence of trips.
export function buildVisits(cards: PhotoCard[]): TimelineVisit[] {
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

export function buildMapPhotos(cards: PhotoCard[]): MapPhoto[] {
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
