import { GalleryCard } from './GalleryCard';
import type { PhotoGroup } from '@/types';

interface Props {
  groups: PhotoGroup[];
}

export function GalleryGrid({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="py-32 text-center text-sm text-zinc-600">
        No photos match these filters.
      </div>
    );
  }

  return (
    // Justified rows, not CSS columns. Multi-column fills top-to-bottom, so the
    // second photo landed *below* the first rather than beside it and the
    // bottom edge was always ragged. Here each item's flex-basis is its aspect
    // ratio times the row height and flex-grow is its aspect ratio, so a row
    // stretches to fill the width while keeping relative proportions intact.
    // The ::after absorbs slack on the final row so one lone photo doesn't
    // balloon to full width.
    <div className="flex flex-wrap gap-0.5 [--row-h:140px] after:grow-[9999] after:content-[''] sm:[--row-h:190px] lg:[--row-h:230px] 2xl:[--row-h:260px]">
      {groups.map((g) => {
        const hero = g.photos[0];
        if (!hero) return null;
        const aspect = hero.width && hero.height ? hero.width / hero.height : 4 / 3;

        return (
          <div
            key={`${g.vehicle.id}|${g.location ?? ''}`}
            style={{
              flexGrow: aspect,
              flexBasis: `calc(var(--row-h) * ${aspect})`,
              height: 'var(--row-h)',
            }}
          >
            <GalleryCard group={g} />
          </div>
        );
      })}
    </div>
  );
}
