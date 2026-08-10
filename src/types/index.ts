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
  q?: string;
}
