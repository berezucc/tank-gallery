import type { Metadata } from 'next';
import Link from 'next/link';
import { getMapPhotos } from '@/lib/supabase/queries';
import { MapShell } from '@/components/map/MapShell';

export const metadata: Metadata = {
  title:       'Map',
  description: 'Where every photo in the gallery was taken, plotted on a map.',
};

export default async function MapPage() {
  const photos = await getMapPhotos();

  return (
    <main className="mx-auto max-w-screen-2xl px-6 py-8">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Map</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {photos.length} photo{photos.length === 1 ? '' : 's'} plotted.{' '}
            <Link href="/" className="text-zinc-300 underline-offset-4 hover:underline">
              ← Back to gallery
            </Link>
          </p>
        </div>
      </div>
      <MapShell photos={photos} />
    </main>
  );
}
