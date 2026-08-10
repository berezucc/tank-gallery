'use client';

import { useLightbox } from './LightboxProvider';
import type { LightboxEntry } from '@/types';

interface Props {
  entry: LightboxEntry;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

// Wraps a server-rendered card so the click opens the lightbox from client
// state. Previously this was a <Link> to /?photo=<id>, which made every click a
// full server round-trip.
export function CardButton({ entry, label, className, style, children }: Props) {
  const { open } = useLightbox();

  return (
    <button
      type="button"
      onClick={() => open(entry, 0)}
      aria-label={`Open ${label}`}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
