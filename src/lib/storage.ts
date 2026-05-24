import { STORAGE_BUCKET } from './constants';

// Build a public URL for a path stored in the photos bucket.
// We construct manually instead of calling supabase.storage.getPublicUrl so this
// works in pure server components without instantiating a client.
export function publicPhotoUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;
}
