'use client';

import { useEffect, useState } from 'react';
import { MapShell } from '@/components/map/MapShell';
import { TimelineView } from './TimelineView';
import { useView } from './ViewProvider';
import type { TimelineVisit } from '@/types';
import type { MapPhoto } from '@/lib/supabase/queries';

interface Props {
  /** Server-rendered grid, kept as children so its first chunk needs no fetch. */
  grid: React.ReactNode;
  /** Active filters, forwarded so a view's data matches what the grid is showing. */
  query: string;
}

// Map and timeline data used to ship with every page load so switching was
// instant. That was ~441KB the grid never touched. Each view now fetches its
// own dataset the first time it is opened and keeps it for the rest of the
// session, so the cost lands once, on the view you actually asked for.
export function GalleryViews({ grid, query }: Props) {
  const { view } = useView();
  const [mapPhotos, setMapPhotos] = useState<MapPhoto[] | null>(null);
  const [visits, setVisits] = useState<TimelineVisit[] | null>(null);
  const [failed, setFailed] = useState(false);

  const needsMap = view === 'map' && mapPhotos === null;
  const needsTimeline = view === 'timeline' && visits === null;

  useEffect(() => {
    if (!needsMap && !needsTimeline) return;
    const kind = needsMap ? 'map' : 'timeline';
    let cancelled = false;

    const qs = new URLSearchParams(query);
    qs.set('kind', kind);
    fetch(`/api/gallery?${qs}`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        if (kind === 'map') setMapPhotos(data.mapPhotos ?? []);
        else setVisits(data.visits ?? []);
        setFailed(false);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, [needsMap, needsTimeline, query]);

  // Changing a filter invalidates whatever was cached for the other views.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setMapPhotos(null);
    setVisits(null);
    setFailed(false);
  }

  if (view === 'grid') return <>{grid}</>;

  const data = view === 'map' ? mapPhotos : visits;
  if (data === null) {
    return (
      <div className="flex h-[75vh] items-center justify-center rounded-md border border-zinc-800 text-sm text-zinc-500">
        {failed ? 'Could not load this view.' : `Loading ${view}…`}
      </div>
    );
  }

  return view === 'map'
    ? <MapShell photos={data as MapPhoto[]} />
    : <TimelineView visits={data as TimelineVisit[]} />;
}
