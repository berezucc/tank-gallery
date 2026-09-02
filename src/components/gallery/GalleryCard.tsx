'use client';

import Image from 'next/image';
import { Flag } from '@/components/ui/Flag';
import { CardButton } from './CardButton';
import type { GridCard } from '@/types';

// Client-rendered now: chunks appended during scroll arrive as JSON, so the
// same component has to draw both the server's first batch and later ones.
// Everything it needs is precomputed in toGridCards — notably blurDataURL,
// which is decoded with sharp and cannot be produced in the browser.
export function GalleryCard({ card }: { card: GridCard }) {
  return (
    <CardButton
      entry={card.entry}
      label={card.vehicleName}
      // Sizing comes from the justified-row wrapper in GalleryGrid.
      className="group relative block h-full w-full overflow-hidden bg-zinc-900 text-left"
    >
      <Image
        src={card.heroUrl}
        alt={card.vehicleName}
        fill
        sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        // The source is already a 600px, ~38KB thumbnail cut by sharp at upload,
        // so Vercel's optimizer would spend a transformation to save a few KB.
        unoptimized
        className="object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.04]"
        {...(card.blurDataURL ? { placeholder: 'blur' as const, blurDataURL: card.blurDataURL } : {})}
      />

      {card.count > 1 && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="3" width="7" height="7" rx="1" />
            <path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-1" />
          </svg>
          {card.count}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="flex items-center gap-1.5 text-sm font-medium leading-tight text-white drop-shadow-md">
          <Flag nation={card.nation} />
          {card.vehicleName}
        </p>
        {card.location && (
          <p className="mt-0.5 text-[11px] text-zinc-300 drop-shadow-md">{card.location}</p>
        )}
      </div>
    </CardButton>
  );
}
