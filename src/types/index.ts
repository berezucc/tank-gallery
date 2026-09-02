import type { VEHICLE_TYPES, VEHICLE_ERAS } from '@/lib/constants';

export type VehicleType = (typeof VEHICLE_TYPES)[number];
export type VehicleEra  = (typeof VEHICLE_ERAS)[number];

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  era: VehicleEra;
  nation: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  vehicle_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  location_taken: string | null;
  date_taken: string | null;
  lat: number | null;
  lng: number | null;
  sort_order: number;
  ai_raw_response: unknown;
  created_at: string;
}

// Vehicle joined with all its photos, sorted by sort_order ascending.
// The first photo (photos[0]) is the "hero" shown in the grid card.
export interface VehicleWithPhotos extends Vehicle {
  photos: Photo[];
}

export interface PhotoCard {
  photo: Photo;
  vehicle: Vehicle;
}

// Trimmed shapes for the lightbox. Every card serialises one of these into the
// client payload, so they carry only fields the lightbox actually renders —
// no blurhash, ai_raw_response, vehicle_id or created_at.
export interface LightboxPhoto {
  id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  location_taken: string | null;
  /**
   * Per-photo vehicle, for entries whose photos are NOT all the same vehicle.
   * A grid card omits it — every photo in that entry shares `entry.vehicle`.
   * A timeline visit sets it on each photo, because one visit spans a whole
   * museum: without it the caption froze on the first photo's vehicle and a
   * Mustang read as "Aircraft · WW2 · Germany" all the way through.
   */
  vehicle?: LightboxVehicle;
}

export interface LightboxVehicle {
  name: string;
  type: VehicleType;
  era: VehicleEra;
  nation: string | null;
}

export interface LightboxEntry {
  vehicle: LightboxVehicle;
  photos: LightboxPhoto[];
}

/** Viewport rect of the thumbnail that was clicked, so the lightbox can grow out of it. */
export interface OriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const GALLERY_VIEWS = ['grid', 'map', 'timeline'] as const;
export type GalleryView = (typeof GALLERY_VIEWS)[number];

export interface TimelinePhoto {
  id: string;
  storage_path: string;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
  vehicle_name: string;
  vehicle_type: VehicleType;
  vehicle_era: VehicleEra;
  vehicle_nation: string | null;
}

// Photos clustered by location + month — one trip to one museum.
export interface TimelineVisit {
  key: string;
  location: string | null;
  dateLabel: string;
  sortKey: number;
  photos: TimelinePhoto[];
}

/**
 * A gallery card, flattened and pre-computed on the server.
 *
 * The grid used to render from PhotoGroup, which carries every column of every
 * photo. Since chunks now arrive over the wire this holds only what a card
 * draws, plus the lightbox entry it opens.
 */
export interface GridCard {
  key: string;
  heroUrl: string;
  aspect: number;
  blurDataURL?: string;
  count: number;
  vehicleName: string;
  nation: string | null;
  location: string | null;
  entry: LightboxEntry;
}

// A group of photos sharing the same vehicle + location.
// Grid shows one card per group; lightbox shows the carousel.
export interface PhotoGroup {
  vehicle: Vehicle;
  photos: Photo[];
  location: string | null;
}

export interface GalleryFilters {
  era?: VehicleEra;
  type?: VehicleType;
  nation?: string;
  /** Exact `photos.location_taken` value. Narrows photos, not just vehicles. */
  location?: string;
  q?: string;
}
