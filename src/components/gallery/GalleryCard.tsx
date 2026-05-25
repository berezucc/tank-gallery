import Image from 'next/image';
import Link from 'next/link';
import { publicPhotoUrl } from '@/lib/storage';
import { blurhashToDataUrl } from '@/lib/blurhash';
import { nationFlag } from '@/lib/constants';
import type { PhotoCard } from '@/types';

interface Props {
  card: PhotoCard;
  searchParams: Record<string, string | undefined>;
}

export async function GalleryCard({ card, searchParams }: Props) {
  const { photo, vehicle } = card;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) params.set(k, v);
  }
  params.set('photo', photo.id);

  const aspect = photo.width && photo.height ? photo.width / photo.height : 4 / 3;
  const blurDataURL = await blurhashToDataUrl(photo.blurhash);

  return (
    <Link
      href={`/?${params.toString()}`}
      scroll={false}
      prefetch={false}
      className="group relative mb-1 block overflow-hidden bg-zinc-900"
      style={{ aspectRatio: aspect }}
    >
      <Image
        src={publicPhotoUrl(photo.thumbnail_path ?? photo.storage_path)}
        alt={vehicle.name}
        fill
        sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        {...(blurDataURL ? { placeholder: 'blur' as const, blurDataURL } : {})}
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
        <p className="text-sm font-medium text-white">
          {nationFlag(vehicle.nation) ? `${nationFlag(vehicle.nation)} ` : ''}{vehicle.name}
        </p>
        {photo.location_taken && (
          <p className="text-xs text-zinc-400">{photo.location_taken}</p>
        )}
      </div>
    </Link>
  );
}
