import Image from 'next/image';
import { publicPhotoUrl } from '@/lib/storage';
import { blurhashToDataUrl } from '@/lib/blurhash';
import { Flag } from '@/components/ui/Flag';
import { CardButton } from './CardButton';
import type { LightboxEntry, PhotoGroup } from '@/types';

interface Props {
  group: PhotoGroup;
}

export async function GalleryCard({ group }: Props) {
  const { vehicle, photos, location } = group;
  const hero = photos[0];
  if (!hero) return null;

  const blurDataURL = await blurhashToDataUrl(hero.blurhash);
  const count = photos.length;

  // Only the fields the lightbox renders — this is serialised to the client.
  const entry: LightboxEntry = {
    vehicle: { name: vehicle.name, type: vehicle.type, era: vehicle.era, nation: vehicle.nation },
    photos: photos.map((p) => ({
      id: p.id,
      storage_path: p.storage_path,
      width: p.width,
      height: p.height,
      location_taken: p.location_taken,
    })),
  };

  return (
    <CardButton
      entry={entry}
      label={vehicle.name}
      // Sizing comes from the justified-row wrapper in GalleryGrid.
      className="group relative block h-full w-full overflow-hidden bg-zinc-900 text-left"
    >
      <Image
        src={publicPhotoUrl(hero.thumbnail_path ?? hero.storage_path)}
        alt={vehicle.name}
        fill
        sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.04]"
        {...(blurDataURL ? { placeholder: 'blur' as const, blurDataURL } : {})}
      />

      {count > 1 && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="3" width="7" height="7" rx="1" />
            <path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-1" />
          </svg>
          {count}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="flex items-center gap-1.5 text-sm font-medium leading-tight text-white drop-shadow-md">
          <Flag nation={vehicle.nation} />
          {vehicle.name}
        </p>
        {location && (
          <p className="mt-0.5 text-[11px] text-zinc-300 drop-shadow-md">{location}</p>
        )}
      </div>
    </CardButton>
  );
}
