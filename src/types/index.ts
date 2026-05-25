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
