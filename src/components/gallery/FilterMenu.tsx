'use client';

import { useEffect, useRef, useState } from 'react';

export interface FilterOption {
  value: string;
  label: string;
  prefix?: React.ReactNode;
}

interface Props {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

// A compact dropdown standing in for a row of pills. Ten always-visible pills
// don't scale — every new vehicle type widened the toolbar.
export function FilterMenu({ label, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={
          'flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-xs transition-colors ' +
          (selected
            ? 'border-zinc-100 bg-zinc-100 font-medium text-zinc-900'
            : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200')
        }
      >
        {selected ? selected.label : label}
        <svg
          width="9" height="9" viewBox="0 0 10 10" fill="none"
          stroke="currentColor" strokeWidth="1.6"
          className={'transition-transform ' + (open ? 'rotate-180' : '')}
        >
          <path d="M2 4l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-9 z-30 max-h-72 min-w-40 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-1 shadow-2xl backdrop-blur-xl"
        >
          <MenuItem
            selected={!value}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            <span className="text-zinc-500">All {label.toLowerCase()}</span>
          </MenuItem>

          {options.map((o) => (
            <MenuItem
              key={o.value}
              selected={o.value === value}
              onClick={() => { onChange(o.value === value ? '' : o.value); setOpen(false); }}
            >
              {o.prefix}
              {o.label}
            </MenuItem>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={
        'flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ' +
        (selected ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-900')
      }
    >
      <span className="flex-1 truncate">{children}</span>
      {selected && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
        </svg>
      )}
    </button>
  );
}
