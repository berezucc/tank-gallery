'use client';

import { useCallback, useState } from 'react';
import { MapShell } from '@/components/map/MapShell';
import { TimelineView } from './TimelineView';
import { GALLERY_VIEWS } from '@/types';
import type { GalleryView, TimelineVisit } from '@/types';
import type { MapPhoto } from '@/lib/supabase/queries';

const LABELS: Record<GalleryView, string> = {
  grid: 'Grid',
  map: 'Map',
  timeline: 'Timeline',
};

interface Props {
  initialView: GalleryView;
  /** Server-rendered grid. Kept as children so its cards stay server components. */
  grid: React.ReactNode;
  mapPhotos: MapPhoto[];
  visits: TimelineVisit[];
}

// All three modes read the same already-filtered dataset, so switching is a
// client state change and any active filter carries across views.
export function GalleryViews({ initialView, grid, mapPhotos, visits }: Props) {
  const [view, setView] = useState<GalleryView>(initialView);

  const select = useCallback((next: GalleryView) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === 'grid') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    window.history.replaceState(null, '', url.pathname + (url.search || ''));
  }, []);

  return (
    <>
      <div className="mb-3 flex items-center gap-1">
        {GALLERY_VIEWS.map((v) => {
          const active = v === view;
          return (
            <button
              key={v}
              type="button"
              onClick={() => select(v)}
              aria-pressed={active}
              className={
                'rounded-full px-3 py-1 text-xs transition-colors ' +
                (active
                  ? 'bg-zinc-100 font-medium text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200')
              }
            >
              {LABELS[v]}
            </button>
          );
        })}
        <span className="ml-3 text-xs text-zinc-600">
          {view === 'map'
            ? `${mapPhotos.length} geotagged`
            : view === 'timeline'
              ? `${visits.length} visit${visits.length === 1 ? '' : 's'}`
              : null}
        </span>
      </div>

      {view === 'grid' && grid}
      {view === 'map' && <MapShell photos={mapPhotos} />}
      {view === 'timeline' && <TimelineView visits={visits} />}
    </>
  );
}
