import { decode } from 'blurhash';
import sharp from 'sharp';

// 16px is plenty: the placeholder is scaled up and blurred anyway, and every
// byte here ships inline in the HTML once per card. At 32px PNG these
// placeholders were 2.0 MB of a 3.7 MB page.
const SIZE = 16;

// Decode a blurhash string into a tiny base64-encoded WebP data URL,
// suitable for next/image's blurDataURL prop. Cached at module level
// since blurhashes are stable per photo.
const cache = new Map<string, string>();

export async function blurhashToDataUrl(hash: string | null): Promise<string | undefined> {
  if (!hash) return undefined;
  const cached = cache.get(hash);
  if (cached) return cached;

  try {
    const pixels = decode(hash, SIZE, SIZE);
    const buf = await sharp(Buffer.from(pixels), {
      raw: { width: SIZE, height: SIZE, channels: 4 },
    })
      .webp({ quality: 40 })
      .toBuffer();
    const dataUrl = `data:image/webp;base64,${buf.toString('base64')}`;
    cache.set(hash, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
}
