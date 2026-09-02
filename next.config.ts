import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Vercel's free tier allows 5,000 image transformations a month and this
    // archive was burning through them for nothing: every photo is already
    // resized and compressed by sharp at upload (600px thumbnail ~38KB, 2400px
    // full ~1.1MB), so re-deriving a dozen widths of a 38KB thumbnail costs a
    // transformation and saves a few KB.
    //
    // Thumbnails are therefore served straight from Supabase's CDN (see the
    // `unoptimized` prop on GalleryCard, TimelineView and the admin PhotoRow) —
    // they are the overwhelming majority of images the site draws. The lightbox
    // keeps optimization, because there it turns a 1.1MB original into roughly
    // 200KB and only runs for a photo somebody actually opened.
    //
    // The two settings below bound what remains: one output format rather than
    // AVIF+WebP, and a 31-day cache so the same image is not re-transformed
    // every few hours.
    formats: ['image/webp'],
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
