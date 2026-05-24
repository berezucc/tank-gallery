import { GalleryCard } from './GalleryCard';
import type { VehicleWithPhotos } from '@/types';

interface Props {
  vehicles: VehicleWithPhotos[];
  searchParams: Record<string, string | undefined>;
}

export function GalleryGrid({ vehicles, searchParams }: Props) {
  if (vehicles.length === 0) {
    return (
      <div className="py-24 text-center text-zinc-500">
        No photos match these filters.
      </div>
    );
  }

  return (
    <div className="columns-2 gap-1 sm:columns-3 lg:columns-4 xl:columns-5">
      {vehicles.map((v) => (
        <div key={v.id} className="break-inside-avoid">
          <GalleryCard vehicle={v} searchParams={searchParams} />
        </div>
      ))}
    </div>
  );
}
