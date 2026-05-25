'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { publicPhotoUrl } from '@/lib/storage';
import { VEHICLE_ERA_LABELS, VEHICLE_TYPE_LABELS } from '@/lib/constants';
import type { PhotoCard } from '@/types';

interface Props {
  cards: PhotoCard[];
  initialIndex: number;
}

export function Lightbox({ cards, initialIndex }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const [index, setIndex] = useState(initialIndex);

  const isOpen = cards.length > 0;
  const current = cards[index] ?? null;

  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete('photo');
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     close();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, cards.length - 1));
      if (e.key === 'ArrowLeft')  setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, cards.length, close]);

  return (
    <AnimatePresence>
      {isOpen && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 sm:p-8"
          onClick={close}
        >
          <button
            onClick={(e) => { e.stopPropagation(); close(); }}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 rounded-full bg-zinc-900/80 p-2 text-zinc-300 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>

          <motion.div
            key={current.photo.id}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1,    opacity: 1 }}
            exit={{    scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative flex h-full w-full max-w-6xl flex-col items-center justify-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex max-h-[75vh] w-full flex-1 items-center justify-center">
              <Image
                src={publicPhotoUrl(current.photo.storage_path)}
                alt={current.vehicle.name}
                width={current.photo.width  ?? 1600}
                height={current.photo.height ?? 1200}
                className="max-h-[75vh] w-auto object-contain"
                priority
              />
            </div>

            {cards.length > 1 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                  disabled={index === 0}
                  className="rounded-full bg-zinc-900 px-3 py-1 text-sm text-zinc-300 disabled:opacity-30 hover:bg-zinc-800"
                  aria-label="Previous photo"
                >
                  ←
                </button>
                <span className="text-xs text-zinc-500">
                  {index + 1} / {cards.length}
                </span>
                <button
                  onClick={() => setIndex((i) => Math.min(i + 1, cards.length - 1))}
                  disabled={index === cards.length - 1}
                  className="rounded-full bg-zinc-900 px-3 py-1 text-sm text-zinc-300 disabled:opacity-30 hover:bg-zinc-800"
                  aria-label="Next photo"
                >
                  →
                </button>
              </div>
            )}

            <div className="text-center">
              <h2 className="text-xl font-semibold text-white">{current.vehicle.name}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {VEHICLE_TYPE_LABELS[current.vehicle.type]} · {VEHICLE_ERA_LABELS[current.vehicle.era]}
                {current.vehicle.nation ? ` · ${current.vehicle.nation}` : ''}
              </p>
              {current.photo.location_taken && (
                <p className="mt-1 text-xs text-zinc-500">{current.photo.location_taken}</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
