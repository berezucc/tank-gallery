import sharp from 'sharp';
import { encode } from 'blurhash';

export interface ProcessedImage {
  thumbnail: Buffer;     // 400px-wide WebP for grid cards
  blurhash: string;      // tiny placeholder string
  width: number;         // original width
  height: number;        // original height
}

export async function processImage(buf: Buffer): Promise<ProcessedImage> {
  const image = sharp(buf, { failOn: 'truncated' }).rotate(); // honor EXIF orientation
  const meta  = await image.metadata();

  if (!meta.width || !meta.height) {
    throw new Error('Could not read image dimensions');
  }

  // Thumbnail: 400px wide WebP, preserve aspect ratio, no upscaling.
  const thumbnail = await image
    .clone()
    .resize(400, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // Blurhash: tiny RGBA buffer downsampled to ~32x32.
  const { data: pixels, info } = await image
    .clone()
    .raw()
    .ensureAlpha()
    .resize(32, 32, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  const blurhash = encode(
    new Uint8ClampedArray(pixels),
    info.width,
    info.height,
    4,
    4
  );

  return { thumbnail, blurhash, width: meta.width, height: meta.height };
}
