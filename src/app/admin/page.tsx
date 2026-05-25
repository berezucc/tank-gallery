import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PhotoRow } from '@/components/admin/PhotoRow';
import type { VehicleEra, VehicleType } from '@/types';

export const dynamic = 'force-dynamic';

interface PhotoListRow {
  id: string;
  storage_path: string;
  thumbnail_path: string | null;
  location_taken: string | null;
  date_taken: string | null;
  created_at: string;
  vehicle: {
    id: string;
    name: string;
    type: VehicleType;
    era: VehicleEra;
    nation: string | null;
  } | null;
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { data: photos, error } = await supabase
    .from('photos')
    .select(`
      id, storage_path, thumbnail_path, location_taken, date_taken, created_at,
      vehicle:vehicles(id, name, type, era, nation)
    `)
    .order('created_at', { ascending: false })
    .returns<PhotoListRow[]>();

  return (
    <main className="mx-auto max-w-screen-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Photos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {photos?.length ?? 0} total
          </p>
        </div>
        <Link
          href="/admin/upload"
          className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          + Upload photos
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-900 bg-red-950 p-3 text-sm text-red-300">
          {error.message}
        </p>
      )}

      {photos && photos.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 w-24"></th>
                <th className="px-3 py-2">Vehicle</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Era</th>
                <th className="px-3 py-2">Nation</th>
                <th className="px-3 py-2 w-32 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {photos.map((p) => (
                <PhotoRow
                  key={p.id}
                  photoId={p.id}
                  storagePath={p.storage_path}
                  thumbnailPath={p.thumbnail_path}
                  vehicle={p.vehicle}
                  locationTaken={p.location_taken}
                  dateTaken={p.date_taken}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-500">
          No photos yet. <Link href="/admin/upload" className="text-zinc-300 underline">Upload your first one.</Link>
        </div>
      )}
    </main>
  );
}
