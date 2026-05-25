import { GalleryCard } from './GalleryCard';
import type { PhotoCard } from '@/types';

interface Props {
  cards: PhotoCard[];
  searchParams: Record<string, string | undefined>;
}

export function GalleryGrid({ cards, searchParams }: Props) {
  if (cards.length === 0) {
    return (
      <div className="py-24 text-center text-zinc-500">
        No photos match these filters.
      </div>
    );
  }

  return (
    <div className="columns-2 gap-1 sm:columns-3 lg:columns-4 xl:columns-5">
      {cards.map((c) => (
        <div key={c.photo.id} className="break-inside-avoid">
          <GalleryCard card={c} searchParams={searchParams} />
        </div>
      ))}
    </div>
  );
}
