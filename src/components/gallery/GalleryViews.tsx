'use client';

import { MapShell } from '@/components/map/MapShell';
import { TimelineView } from './TimelineView';
import { useView } from './ViewProvider';
import type { TimelineVisit } from '@/types';
import type { MapPhoto } from '@/lib/supabase/queries';

interface Props {
  /** Server-rendered grid. Kept as children so its cards stay server components. */
  grid: React.ReactNode;
  mapPhotos: MapPhoto[];
  visits: TimelineVisit[];
}

// All three modes read the same already-filtered dataset, so switching is a
// client state change and any active filter carries across views.
export function GalleryViews({ grid, mapPhotos, visits }: Props) {
  const { view } = useView();

  if (view === 'map')      return <MapShell photos={mapPhotos} />;
  if (view === 'timeline') return <TimelineView visits={visits} />;
  return <>{grid}</>;
}
