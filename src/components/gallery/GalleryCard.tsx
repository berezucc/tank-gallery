import Image from 'next/image';
import Link from 'next/link';
import { publicPhotoUrl } from '@/lib/storage';
import { blurhashToDataUrl } from '@/lib/blurhash';
import { nationFlag } from '@/lib/constants';
import type { PhotoGroup } from '@/types';

interface Props {
  group: PhotoGroup;
  searchParams: Record<string, string | undefined>;
}

export async function GalleryCard({ group, searchParams }: Props) {
  const { vehicle, photos, location } = group;
  const hero = photos[0];
  if (!hero) return null;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) params.set(k, v);
  }
  params.set('photo', hero.id);

  const aspect = hero.width && hero.height ? hero.width / hero.height : 4 / 3;
  const blurDataURL = await blurhashToDataUrl(hero.blurhash);
  const flag = nationFlag(vehicle.nation);
  const count = photos.length;

  return (
    <Link
      href={`/?${params.toString()}`}
      scroll={false}
      prefetch={false}
      className="group relative block overflow-hidden bg-zinc-900"
      style={{ aspectRatio: aspect }}
    >
      <Image
        src={publicPhotoUrl(hero.thumbnail_path ?? hero.storage_path)}
        alt={vehicle.name}
        fill
        sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.04]"
        {...(blurDataURL ? { placeholder: 'blur' as const, blurDataURL } : {})}
      />

      {/* Photo count badge */}
      {count > 1 && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="3" width="7" height="7" rx="1" />
            <path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-1" />
          </svg>
          {count}
        </div>
      )}

      {/* Overlay — visible on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="text-sm font-medium leading-tight text-white drop-shadow-md">
          {flag ? `${flag}\u{200a} ` : ''}{vehicle.name}
        </p>
        {location && (
          <p className="mt-0.5 text-[11px] text-zinc-300 drop-shadow-md">{location}</p>
        )}
      </div>
    </Link>
  );
}
