'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VEHICLE_TYPES,
  VEHICLE_ERAS,
  VEHICLE_TYPE_LABELS,
  VEHICLE_ERA_LABELS,
} from '@/lib/constants';

interface Props {
  availableNations: string[];
}

export function FilterBar({ availableNations }: Props) {
  const router    = useRouter();
  const pathname  = usePathname();
  const params    = useSearchParams();

  const activeEra    = params.get('era')    ?? '';
  const activeType   = params.get('type')   ?? '';
  const activeNation = params.get('nation') ?? '';
  const activeQ      = params.get('q')      ?? '';
  const anyActive    = Boolean(activeEra || activeType || activeNation || activeQ);

  // Local input state so typing is responsive; pushed to URL on debounce.
  const [q, setQ] = useState(activeQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep input synced if URL changes externally (e.g. clear-all).
  useEffect(() => { setQ(activeQ); }, [activeQ]);

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

  const updateParam = useCallback(
    (key: 'era' | 'type' | 'nation', value: string) => {
      pushParams((p) => {
        if (p.get(key) === value) p.delete(key);
        else                      p.set(key, value);
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
    router.push(pathname, { scroll: false });
  };

  return (
    <div className="sticky top-0 z-10 -mx-6 mb-6 border-b border-zinc-800 bg-[#0a0a0a]/95 px-6 py-4 backdrop-blur">
      <div className="mb-3 flex items-center gap-3">
        <input
          type="search"
          placeholder="Search vehicle names…"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full max-w-sm rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
        {anyActive && (
          <button
            onClick={clearAll}
            className="text-xs text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <FilterGroup
          label="Era"
          options={VEHICLE_ERAS.map((e) => ({ value: e, label: VEHICLE_ERA_LABELS[e] }))}
          active={activeEra}
          onToggle={(v) => updateParam('era', v)}
        />
        <FilterGroup
          label="Type"
          options={VEHICLE_TYPES.map((t) => ({ value: t, label: VEHICLE_TYPE_LABELS[t] }))}
          active={activeType}
          onToggle={(v) => updateParam('type', v)}
        />
        {availableNations.length > 0 && (
          <FilterGroup
            label="Nation"
            options={availableNations.map((n) => ({ value: n, label: n }))}
            active={activeNation}
            onToggle={(v) => updateParam('nation', v)}
          />
        )}
      </div>
    </div>
  );
}

interface GroupProps {
  label: string;
  options: { value: string; label: string }[];
  active: string;
  onToggle: (v: string) => void;
}

function FilterGroup({ label, options, active, onToggle }: GroupProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = active === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onToggle(o.value)}
              className={
                'rounded-full px-3 py-1 text-xs transition-colors ' +
                (on
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800')
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
