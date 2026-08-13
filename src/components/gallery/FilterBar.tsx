'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import {
  VEHICLE_TYPES,
  VEHICLE_ERAS,
  VEHICLE_TYPE_LABELS,
  VEHICLE_ERA_LABELS,
  nationFlag,
} from '@/lib/constants';
import { FilterMenu } from './FilterMenu';
import { ViewSwitcher } from './ViewProvider';

interface Props {
  availableNations: string[];
}

export function FilterBar({ availableNations }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const activeEra    = params.get('era')    ?? '';
  const activeType   = params.get('type')   ?? '';
  const activeNation = params.get('nation') ?? '';
  const activeQ      = params.get('q')      ?? '';

  const [q, setQ] = useState(activeQ);
  // Sync the input when the URL changes underneath us (back button, Clear all)
  // by comparing against the last seen value during render. An effect that
  // called setQ would trigger a cascading re-render.
  const [lastQ, setLastQ] = useState(activeQ);
  if (activeQ !== lastQ) {
    setLastQ(activeQ);
    setQ(activeQ);
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete('photo');
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  const setParam = useCallback(
    (key: string, value: string) => {
      pushParams((p) => {
        if (value) p.set(key, value);
        else       p.delete(key);
      });
    },
    [pushParams]
  );

  function onSearchChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams((p) => {
        const trimmed = value.trim();
        if (trimmed) p.set('q', trimmed);
        else         p.delete('q');
      });
    }, 300);
  }

  const clearAll = () => {
    setQ('');
    // Preserve the current view so clearing filters doesn't kick you to Grid.
    const view = params.get('view');
    router.push(view ? `${pathname}?view=${view}` : pathname, { scroll: false });
  };

  const chips = [
    activeQ      && { key: 'q',      label: `“${activeQ}”` },
    activeEra    && { key: 'era',    label: VEHICLE_ERA_LABELS[activeEra as keyof typeof VEHICLE_ERA_LABELS] ?? activeEra },
    activeType   && { key: 'type',   label: VEHICLE_TYPE_LABELS[activeType as keyof typeof VEHICLE_TYPE_LABELS] ?? activeType },
    activeNation && { key: 'nation', label: `${nationFlag(activeNation)} ${activeNation}`.trim() },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 bg-[#0a0a0a]/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-2">
        <div className="relative">
          <svg
            width="13" height="13" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" strokeWidth="1.6"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          >
            <circle cx="6" cy="6" r="4.2" />
            <path d="M9.2 9.2L12.5 12.5" />
          </svg>
          <input
            type="search"
            placeholder="Search…"
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 w-40 rounded-full border border-zinc-800 bg-zinc-900/60 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 sm:w-52"
          />
        </div>

        <FilterMenu
          label="Era"
          value={activeEra}
          onChange={(v) => setParam('era', v)}
          options={VEHICLE_ERAS.filter((e) => e !== 'other').map((e) => ({
            value: e,
            label: VEHICLE_ERA_LABELS[e],
          }))}
        />

        <FilterMenu
          label="Type"
          value={activeType}
          onChange={(v) => setParam('type', v)}
          options={VEHICLE_TYPES.filter((t) => t !== 'other').map((t) => ({
            value: t,
            label: VEHICLE_TYPE_LABELS[t],
          }))}
        />

        <FilterMenu
          label="Nation"
          value={activeNation}
          onChange={(v) => setParam('nation', v)}
          options={availableNations.map((n) => ({
            value: n,
            label: `${nationFlag(n)} ${n}`.trim(),
          }))}
        />

        <div className="ml-auto">
          <ViewSwitcher />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setParam(c.key, '')}
              className="group flex h-6 items-center gap-1.5 rounded-full bg-zinc-800/80 pl-2.5 pr-2 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              {c.label}
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-zinc-500 group-hover:text-zinc-200">
                <path d="M2 2l6 6M8 2l-6 6" />
              </svg>
            </button>
          ))}
          <button
            onClick={clearAll}
            className="h-6 px-2 text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
