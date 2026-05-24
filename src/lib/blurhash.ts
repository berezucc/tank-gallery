import { decode } from 'blurhash';
import sharp from 'sharp';

const SIZE = 32;

// Decode a blurhash string into a tiny base64-encoded PNG data URL,
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
      .png()
      .toBuffer();
    const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    cache.set(hash, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
}
