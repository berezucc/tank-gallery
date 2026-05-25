import { GalleryCard } from './GalleryCard';
import type { PhotoGroup } from '@/types';

interface Props {
  groups: PhotoGroup[];
  searchParams: Record<string, string | undefined>;
}

export function GalleryGrid({ groups, searchParams }: Props) {
  if (groups.length === 0) {
    return (
      <div className="py-32 text-center text-sm text-zinc-600">
        No photos match these filters.
      </div>
    );
  }

  return (
    <div className="columns-2 gap-0.5 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6">
      {groups.map((g) => (
        <div key={`${g.vehicle.id}|${g.location ?? ''}`} className="mb-0.5 break-inside-avoid">
          <GalleryCard group={g} searchParams={searchParams} />
        </div>
      ))}
    </div>
  );
}
