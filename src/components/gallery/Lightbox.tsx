'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useEffect } from 'react';

// Swipe thresholds: distance in px, or offset×velocity for a quick flick.
const SWIPE_DISTANCE = 70;
const SWIPE_POWER = 500;
import { publicPhotoUrl } from '@/lib/storage';
import { VEHICLE_ERA_LABELS, VEHICLE_TYPE_LABELS } from '@/lib/constants';
import { Flag } from '@/components/ui/Flag';
import type { LightboxEntry } from '@/types';

interface Props {
  entry: LightboxEntry | null;
  index: number;
  onClose: () => void;
  onGoTo: (index: number) => void;
}

export function Lightbox({ entry, index, onClose, onGoTo }: Props) {
  const isOpen = Boolean(entry && entry.photos.length > 0);
  const photo = entry?.photos[index] ?? null;
  const count = entry?.photos.length ?? 0;

  const go = (delta: number) => onGoTo(Math.min(Math.max(index + delta, 0), count - 1));

  // A drag that ends past either threshold advances. Multiplying offset by
  // velocity means a short flick counts as much as a slow long drag.
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const power = info.offset.x * info.velocity.x;
    if (info.offset.x < -SWIPE_DISTANCE || power < -SWIPE_POWER)     go(1);
    else if (info.offset.x > SWIPE_DISTANCE || power > SWIPE_POWER)  go(-1);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowRight') onGoTo(Math.min(index + 1, count - 1));
      if (e.key === 'ArrowLeft')  onGoTo(Math.max(index - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, index, count, onClose, onGoTo]);

  // Stop the page behind the overlay from scrolling while it's open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && entry && photo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 sm:p-8"
          onClick={onClose}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 rounded-full bg-zinc-900/80 p-2 text-zinc-300 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>

          <motion.div
            key={photo.id}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1,    opacity: 1 }}
            exit={{    scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative flex h-full w-full max-w-6xl flex-col items-center justify-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="relative flex max-h-[75vh] w-full flex-1 cursor-grab items-center justify-center active:cursor-grabbing"
              drag={count > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              dragMomentum={false}
              onDragEnd={onDragEnd}
            >
              <Image
                src={publicPhotoUrl(photo.storage_path)}
                alt={entry.vehicle.name}
                width={photo.width  ?? 1600}
                height={photo.height ?? 1200}
                className="pointer-events-none max-h-[75vh] w-auto select-none object-contain"
                draggable={false}
                priority
              />
            </motion.div>

            {count > 1 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onGoTo(Math.max(index - 1, 0))}
                  disabled={index === 0}
                  className="rounded-full bg-zinc-900 px-3 py-1 text-sm text-zinc-300 disabled:opacity-30 hover:bg-zinc-800"
                  aria-label="Previous photo"
                >
                  ←
                </button>
                <span className="text-xs text-zinc-500">
                  {index + 1} / {count}
                </span>
                <button
                  onClick={() => onGoTo(Math.min(index + 1, count - 1))}
                  disabled={index === count - 1}
                  className="rounded-full bg-zinc-900 px-3 py-1 text-sm text-zinc-300 disabled:opacity-30 hover:bg-zinc-800"
                  aria-label="Next photo"
                >
                  →
                </button>
              </div>
            )}

            <div className="text-center">
              <h2 className="flex items-center justify-center gap-2 text-xl font-semibold text-white">
                <Flag nation={entry.vehicle.nation} />
                {entry.vehicle.name}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                {VEHICLE_TYPE_LABELS[entry.vehicle.type]} · {VEHICLE_ERA_LABELS[entry.vehicle.era]}
                {entry.vehicle.nation ? ` · ${entry.vehicle.nation}` : ''}
              </p>
              {photo.location_taken && (
                <p className="mt-1 text-xs text-zinc-500">{photo.location_taken}</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
