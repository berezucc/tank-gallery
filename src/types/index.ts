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

// A photo card in the gallery grid. Each photo gets its own card.
// Photos with the same vehicle + location + date are grouped into a
// carousel in the lightbox.
export interface PhotoCard {
  photo: Photo;
  vehicle: Vehicle;
}

export interface GalleryFilters {
  era?: VehicleEra;
  type?: VehicleType;
  nation?: string;
  q?: string;
}
