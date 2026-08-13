'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Lightbox } from './Lightbox';
import type { LightboxEntry, OriginRect } from '@/types';

interface LightboxApi {
  open: (entry: LightboxEntry, index: number, origin?: OriginRect) => void;
}

const Ctx = createContext<LightboxApi | null>(null);

export function useLightbox(): LightboxApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useLightbox must be used inside <LightboxProvider>');
  return api;
}

// Writes ?photo=<id> without going through the Next router, so opening a photo
// stays a pure client state change. Router navigation would re-run the page's
// server component — refetching every vehicle and photo — on every click.
function syncUrl(photoId: string | null, mode: 'push' | 'replace') {
  const url = new URL(window.location.href);
  if (photoId) url.searchParams.set('photo', photoId);
  else url.searchParams.delete('photo');
  const next = url.pathname + (url.search || '') + url.hash;
  if (mode === 'push') window.history.pushState(null, '', next);
  else window.history.replaceState(null, '', next);
}

interface Props {
  children: React.ReactNode;
  /** Server-resolved entry for a ?photo=<id> deep link on first load. */
  initialEntry: LightboxEntry | null;
  initialIndex: number;
}

export function LightboxProvider({ children, initialEntry, initialIndex }: Props) {
  const [entry, setEntry] = useState<LightboxEntry | null>(initialEntry);
  const [index, setIndex] = useState(initialIndex);
  const [origin, setOrigin] = useState<OriginRect | null>(null);

  const open = useCallback((next: LightboxEntry, i: number, from?: OriginRect) => {
    setOrigin(from ?? null);
    setEntry(next);
    setIndex(i);
    syncUrl(next.photos[i]?.id ?? null, 'push');
  }, []);

  const close = useCallback(() => {
    setEntry(null);
    setOrigin(null);
    syncUrl(null, 'replace');
  }, []);

  // Keep the URL pointing at the photo actually on screen, so a refresh or a
  // copied link lands where the user is rather than where they started.
  const goTo = useCallback((i: number) => {
    setIndex(i);
    setEntry((cur) => {
      if (cur?.photos[i]) syncUrl(cur.photos[i].id, 'replace');
      return cur;
    });
  }, []);

  // Back button should dismiss the lightbox rather than leave the gallery.
  useEffect(() => {
    const onPop = () => {
      const has = new URL(window.location.href).searchParams.get('photo');
      if (!has) setEntry(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const api = useMemo(() => ({ open }), [open]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <Lightbox entry={entry} index={index} origin={origin} onClose={close} onGoTo={goTo} />
    </Ctx.Provider>
  );
}
