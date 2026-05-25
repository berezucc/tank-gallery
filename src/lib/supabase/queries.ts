import { createClient } from './server';
import type { GalleryFilters, Photo, VehicleWithPhotos } from '@/types';

// Fetch vehicles + their photos, applying filters. Each vehicle's photos are
// sorted by sort_order so callers can treat photos[0] as the hero.
export async function getGalleryVehicles(
  filters: GalleryFilters = {}
): Promise<VehicleWithPhotos[]> {
  const supabase = await createClient();

  let query = supabase
    .from('vehicles')
    .select('id, name, type, era, nation, created_at, photos(*)')
    .order('created_at', { ascending: false });

  if (filters.era)    query = query.eq('era', filters.era);
  if (filters.type)   query = query.eq('type', filters.type);
  if (filters.nation) query = query.eq('nation', filters.nation);
  if (filters.q) {
    // Escape % and _ then wrap with wildcards for a simple substring match.
    const escaped = filters.q.replace(/[%_]/g, (c) => `\\${c}`);
    query = query.ilike('name', `%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id:         row.id,
    name:       row.name,
    type:       row.type,
    era:        row.era,
    nation:     row.nation,
    created_at: row.created_at,
    photos:     ((row.photos as Photo[]) ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

// Total photo count (unfiltered), for "X of Y" display when filters are active.
export async function getGalleryTotalCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true });
  if (error) return 0;
  return count ?? 0;
}

// Aggregate counts for the /stats page. Done as a single fetch + JS aggregation
// rather than multiple GROUP BY queries since the dataset is small (≤500 photos).
export interface Stats {
  totalVehicles: number;
  totalPhotos:   number;
  byEra:    { key: string; count: number }[];
  byType:   { key: string; count: number }[];
  byNation: { key: string; count: number }[];
  mostPhotographed: { id: string; name: string; count: number }[];
}

export async function getStats(): Promise<Stats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, name, type, era, nation, photos(count)')
    .returns<{
      id: string;
      name: string;
      type: string;
      era: string;
      nation: string | null;
      photos: { count: number }[];
    }[]>();
  if (error) throw error;

  const vehicles = data ?? [];
  let totalPhotos = 0;
  const eraMap    = new Map<string, number>();
  const typeMap   = new Map<string, number>();
  const nationMap = new Map<string, number>();
  const perVehicle: { id: string; name: string; count: number }[] = [];

  for (const v of vehicles) {
    const c = v.photos[0]?.count ?? 0;
    totalPhotos += c;
    eraMap.set(v.era,   (eraMap.get(v.era)   ?? 0) + 1);
    typeMap.set(v.type, (typeMap.get(v.type) ?? 0) + 1);
    if (v.nation) nationMap.set(v.nation, (nationMap.get(v.nation) ?? 0) + 1);
    perVehicle.push({ id: v.id, name: v.name, count: c });
  }

  const toSorted = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

  return {
    totalVehicles: vehicles.length,
    totalPhotos,
    byEra:    toSorted(eraMap),
    byType:   toSorted(typeMap),
    byNation: toSorted(nationMap),
    mostPhotographed: perVehicle
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .filter((v) => v.count > 0),
  };
}

// For the map view: every photo with coordinates, plus enough vehicle info to label markers.
export interface MapPhoto {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  storage_path: string;
  thumbnail_path: string | null;
  location_taken: string | null;
  lat: number;
  lng: number;
}

export async function getMapPhotos(): Promise<MapPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('photos')
    .select('id, vehicle_id, storage_path, thumbnail_path, location_taken, lat, lng, vehicle:vehicles(name)')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .returns<{
      id: string;
      vehicle_id: string;
      storage_path: string;
      thumbnail_path: string | null;
      location_taken: string | null;
      lat: number;
      lng: number;
      vehicle: { name: string } | null;
    }[]>();

  if (error) throw error;
  return (data ?? []).map((p) => ({
    id:             p.id,
    vehicle_id:     p.vehicle_id,
    vehicle_name:   p.vehicle?.name ?? 'Unknown',
    storage_path:   p.storage_path,
    thumbnail_path: p.thumbnail_path,
    location_taken: p.location_taken,
    lat:            p.lat,
    lng:            p.lng,
  }));
}
