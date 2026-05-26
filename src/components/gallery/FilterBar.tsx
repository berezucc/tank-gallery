'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VEHICLE_TYPES,
  VEHICLE_ERAS,
  VEHICLE_TYPE_LABELS,
  VEHICLE_ERA_LABELS,
  nationFlag,
} from '@/lib/constants';
import { Flag } from '@/components/ui/Flag';

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
  const anyActive    = Boolean(activeEra || activeType || activeNation || activeQ);

  const [q, setQ] = useState(activeQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const toggle = useCallback(
    (key: string, value: string) => {
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
    <div className="sticky top-0 z-10 -mx-4 mb-4 bg-[#0a0a0a]/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <input
          type="search"
          placeholder="Search…"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-44 rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700"
        />

        <Sep />

        {/* Era */}
        {VEHICLE_ERAS.filter((e) => e !== 'other').map((era) => (
          <Pill key={era} active={activeEra === era} onClick={() => toggle('era', era)}>
            {VEHICLE_ERA_LABELS[era]}
          </Pill>
        ))}

        <Sep />

        {/* Type */}
        {VEHICLE_TYPES.filter((t) => t !== 'other').map((type) => (
          <Pill key={type} active={activeType === type} onClick={() => toggle('type', type)}>
            {VEHICLE_TYPE_LABELS[type]}
          </Pill>
        ))}

        <Sep />

        {/* Nation — dropdown instead of 20+ pills */}
        <select
          value={activeNation}
          onChange={(e) => {
            pushParams((p) => {
              if (e.target.value) p.set('nation', e.target.value);
              else                p.delete('nation');
            });
          }}
          className={
            'h-8 cursor-pointer rounded-full border px-3 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-700 ' +
            (activeNation
              ? 'border-zinc-100 bg-zinc-100 text-zinc-900'
              : 'border-zinc-800 bg-zinc-900/80 text-zinc-400')
          }
        >
          <option value="">All nations</option>
          {availableNations.map((n) => (
            <option key={n} value={n}>{nationFlag(n)} {n}</option>
          ))}
        </select>

        {/* Clear */}
        {anyActive && (
          <button
            onClick={clearAll}
            className="ml-auto h-8 rounded-full border border-zinc-800 px-3 text-xs text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        'h-8 rounded-full border px-3.5 text-xs font-medium transition-all ' +
        (active
          ? 'border-zinc-100 bg-zinc-100 text-zinc-900'
          : 'border-zinc-800 bg-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-200')
      }
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="hidden h-4 w-px bg-zinc-800 sm:block" />;
}
