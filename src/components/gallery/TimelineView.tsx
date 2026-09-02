'use client';

import Image from 'next/image';
import { publicPhotoUrl } from '@/lib/storage';
import { useLightbox } from './LightboxProvider';
import type { LightboxEntry, TimelineVisit } from '@/types';

const ROW_H = 150;

interface Props {
  visits: TimelineVisit[];
}

// A visit is a location + month cluster: "Battleship New Jersey Museum,
// Camden NJ — August 2026 — 36 photos". Reverse chronological, so the archive
// reads as a sequence of trips rather than an undifferentiated wall.
export function TimelineView({ visits }: Props) {
  const { open } = useLightbox();

  if (visits.length === 0) {
    return (
      <div className="py-32 text-center text-sm text-zinc-600">
        No photos match these filters.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {visits.map((visit) => {
        // One lightbox entry per visit, so arrows walk the whole trip. A visit
        // spans a whole museum, so each photo carries its OWN vehicle — the
        // entry-level one is only the fallback the type requires.
        const entry: LightboxEntry = {
          vehicle: {
            name: visit.photos[0].vehicle_name,
            type: visit.photos[0].vehicle_type,
            era: visit.photos[0].vehicle_era,
            nation: visit.photos[0].vehicle_nation,
          },
          photos: visit.photos.map((p) => ({
            id: p.id,
            storage_path: p.storage_path,
            width: p.width,
            height: p.height,
            location_taken: visit.location,
            vehicle: {
              name: p.vehicle_name,
              type: p.vehicle_type,
              era: p.vehicle_era,
              nation: p.vehicle_nation,
            },
          })),
        };

        return (
          <section key={visit.key}>
            <header className="mb-3 flex items-baseline gap-3 border-b border-zinc-900 pb-2">
              <h2 className="text-sm font-medium tracking-tight text-zinc-100">
                {visit.location ?? 'Location unknown'}
              </h2>
              <span className="text-xs text-zinc-500">{visit.dateLabel}</span>
              <span className="ml-auto text-xs tabular-nums text-zinc-600">
                {visit.photos.length} photo{visit.photos.length === 1 ? '' : 's'}
              </span>
            </header>

            <div className="flex flex-wrap gap-1">
              {visit.photos.map((p, i) => {
                const ratio = p.width && p.height ? p.width / p.height : 4 / 3;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      open(entry, i, { x: r.x, y: r.y, width: r.width, height: r.height });
                    }}
                    aria-label={`Open ${p.vehicle_name}`}
                    className="group relative overflow-hidden bg-zinc-900"
                    style={{ height: ROW_H, width: ROW_H * ratio }}
                  >
                    <Image
                      src={publicPhotoUrl(p.thumbnail_path ?? p.storage_path)}
                      alt={p.vehicle_name}
                      fill
                      sizes="300px"
                      unoptimized
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="truncate text-[10px] font-medium text-white">{p.vehicle_name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
