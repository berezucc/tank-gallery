// Build a public URL for a path stored in the photos bucket (Cloudflare R2,
// see src/lib/r2.ts). Works on server and client: it only reads a public env var.
// Cache-bust version. Bump this after re-processing images in storage
// to force Vercel's image optimization CDN to fetch fresh copies.
const CACHE_VERSION = 2;

export function publicPhotoUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_PHOTOS_BASE_URL!;
  return `${base}/${storagePath}?v=${CACHE_VERSION}`;
}
