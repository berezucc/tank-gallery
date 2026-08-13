'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { GALLERY_VIEWS } from '@/types';
import type { GalleryView } from '@/types';

interface ViewApi {
  view: GalleryView;
  setView: (v: GalleryView) => void;
}

const Ctx = createContext<ViewApi | null>(null);

export function useView(): ViewApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useView must be used inside <ViewProvider>');
  return api;
}

export function ViewProvider({
  initialView,
  children,
}: {
  initialView: GalleryView;
  children: React.ReactNode;
}) {
  const [view, setViewState] = useState<GalleryView>(initialView);

  // replaceState, not the router: switching views must not re-run the page's
  // server component, since all three modes render from data already on screen.
  const setView = useCallback((next: GalleryView) => {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next === 'grid') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    window.history.replaceState(null, '', url.pathname + (url.search || ''));
  }, []);

  const api = useMemo(() => ({ view, setView }), [view, setView]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

const LABELS: Record<GalleryView, string> = {
  grid: 'Grid',
  map: 'Map',
  timeline: 'Timeline',
};

export function ViewSwitcher() {
  const { view, setView } = useView();

  return (
    <div
      role="tablist"
      aria-label="Gallery view"
      className="flex items-center gap-0.5 rounded-full border border-zinc-800 bg-zinc-900/60 p-0.5"
    >
      {GALLERY_VIEWS.map((v) => {
        const active = v === view;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setView(v)}
            className={
              'rounded-full px-3 py-1 text-xs transition-colors ' +
              (active
                ? 'bg-zinc-100 font-medium text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-200')
            }
          >
            {LABELS[v]}
          </button>
        );
      })}
    </div>
  );
}
