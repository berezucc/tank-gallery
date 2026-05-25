import { GalleryCard } from './GalleryCard';
import type { PhotoCard } from '@/types';

interface Props {
  cards: PhotoCard[];
  searchParams: Record<string, string | undefined>;
}

export function GalleryGrid({ cards, searchParams }: Props) {
  if (cards.length === 0) {
    return (
      <div className="py-32 text-center text-sm text-zinc-600">
        No photos match these filters.
      </div>
    );
  }

  return (
    <div className="columns-2 gap-0.5 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6">
      {cards.map((c) => (
        <div key={c.photo.id} className="mb-0.5 break-inside-avoid">
          <GalleryCard card={c} searchParams={searchParams} />
        </div>
      ))}
    </div>
  );
}
