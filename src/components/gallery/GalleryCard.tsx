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
  const flag = nationFlag(vehicle.nation);

  return (
    <Link
      href={`/?${params.toString()}`}
      scroll={false}
      prefetch={false}
      className="group relative block overflow-hidden bg-zinc-900"
      style={{ aspectRatio: aspect }}
    >
      <Image
        src={publicPhotoUrl(photo.thumbnail_path ?? photo.storage_path)}
        alt={vehicle.name}
        fill
        sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.04]"
        {...(blurDataURL ? { placeholder: 'blur' as const, blurDataURL } : {})}
      />
      {/* Overlay — visible on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="text-sm font-medium leading-tight text-white drop-shadow-md">
          {flag ? `${flag}\u{200a} ` : ''}{vehicle.name}
        </p>
        {photo.location_taken && (
          <p className="mt-0.5 text-[11px] text-zinc-300 drop-shadow-md">{photo.location_taken}</p>
        )}
      </div>
    </Link>
  );
}
