import { STORAGE_BUCKET } from './constants';

// Build a public URL for a path stored in the photos bucket.
// We construct manually instead of calling supabase.storage.getPublicUrl so this
// works in pure server components without instantiating a client.
// Cache-bust version. Bump this after re-processing images in storage
// to force Vercel's image optimization CDN to fetch fresh copies.
const CACHE_VERSION = 2;

export function publicPhotoUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}?v=${CACHE_VERSION}`;
}
