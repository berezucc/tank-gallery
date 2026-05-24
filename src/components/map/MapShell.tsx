'use client';

// Leaflet touches `window` at import-time. To keep it out of the server bundle
// entirely we lazy-load MapView via next/dynamic with ssr: false. The shell
// itself is the smallest possible client component that can call dynamic().

import dynamic from 'next/dynamic';
import type { MapPhoto } from '@/lib/supabase/queries';

const MapView = dynamic(
  () => import('./MapView').then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[75vh] items-center justify-center rounded-md border border-zinc-800 text-sm text-zinc-500">
        Loading map…
      </div>
    ),
  }
);

export function MapShell({ photos }: { photos: MapPhoto[] }) {
  return <MapView photos={photos} />;
}
