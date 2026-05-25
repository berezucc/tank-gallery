'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';

// Resize an image in the browser before uploading. Prevents API route body
// size failures for large camera JPEGs and speeds up uploads/classification.
function resizeImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else       { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Resize failed')),
        'image/jpeg',
        quality
      );
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('Image load failed')); };
    img.src = URL.createObjectURL(file);
  });
}
import {
  VEHICLE_TYPES,
  VEHICLE_ERAS,
  VEHICLE_TYPE_LABELS,
  VEHICLE_ERA_LABELS,
} from '@/lib/constants';
import type { VehicleEra, VehicleType } from '@/types';

type Status = 'uploading' | 'ready' | 'saving' | 'saved' | 'error';

interface AiSuggestion {
  name: string;
  type: VehicleType;
  era: VehicleEra;
  nation: string;
  confidence: 'high' | 'medium' | 'low';
  existing_match?: string;
}

interface ExistingVehicle {
  id: string;
  name: string;
  type: VehicleType;
  era: VehicleEra;
  nation: string | null;
}

interface PendingItem {
  id: string;
  file: File | null;
  fileName: string;
  previewUrl: string | null;
  status: Status;
  errorMsg?: string;
  classifying: boolean;
  ai?: AiSuggestion;
  upload?: {
    storage_path: string;
    thumbnail_path: string;
    blurhash: string;
    width: number;
    height: number;
  };
  name: string;
  type: VehicleType;
  era: VehicleEra;
  nation: string;
  location: string;
  date: string;
  metadataTouched: boolean;
  existing?: ExistingVehicle;
}

const STORAGE_KEY = 'tank-gallery-pending-uploads';

function persistItems(items: PendingItem[]) {
  const saveable = items
    .filter((i) => i.status === 'ready' || i.status === 'error')
    .filter((i) => i.upload)
    .map((i) => ({
      id: i.id, fileName: i.fileName, upload: i.upload, ai: i.ai,
      name: i.name, type: i.type, era: i.era, nation: i.nation,
      location: i.location, date: i.date,
      metadataTouched: i.metadataTouched, existing: i.existing,
    }));
  if (saveable.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveable));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadPersistedItems(): PendingItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    return parsed.map((p) => ({
      id:       (p.id as string) || crypto.randomUUID(),
      file:     null,
      fileName: (p.fileName as string) || 'restored',
      previewUrl: null,
      status:   'ready' as Status,
      classifying: false,
      ai:       p.ai as AiSuggestion | undefined,
      upload:   p.upload as PendingItem['upload'],
      name:     (p.name as string) ?? '',
      type:     (p.type as VehicleType) ?? 'other',
      era:      (p.era as VehicleEra) ?? 'other',
      nation:   (p.nation as string) ?? '',
      location: (p.location as string) ?? '',
      date:     (p.date as string) ?? '',
      metadataTouched: Boolean(p.metadataTouched),
      existing: p.existing as ExistingVehicle | undefined,
    }));
  } catch {
    return [];
  }
}

export function UploadZone() {
  const router = useRouter();
  const [items, setItems] = useState<PendingItem[]>(() => loadPersistedItems());

  // Persist to localStorage whenever items change (ready/error items only).
  useEffect(() => { persistItems(items); }, [items]);

  // Warn before leaving if there are unsaved uploads.
  useEffect(() => {
    const hasUnsaved = items.some((i) => i.status !== 'saved' && (i.status === 'ready' || i.status === 'uploading' || i.status === 'error'));
    if (!hasUnsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [items]);

  const onDrop = useCallback(async (accepted: File[]) => {
    const newItems: PendingItem[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
      classifying: true,
      name: '',
      type: 'tank',
      era: 'ww2',
      nation: '',
      location: '',
      date: '',
      metadataTouched: false,
    }));
    setItems((prev) => [...prev, ...newItems]);

    // Process with limited concurrency so 200 files don't fire 400 API calls at once.
    // 5 concurrent items × 2 parallel calls each (upload + classify) = 10 in flight.
    const CONCURRENCY = 5;
    const queue = [...newItems];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const item = queue.shift()!;
        await Promise.all([
          uploadOne(item, setItems),
          classifyOne(item, setItems),
        ]);
      }
    });
    await Promise.all(workers);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
  });

  function updateItem(id: string, patch: Partial<PendingItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function touchMetadata(id: string, patch: Partial<PendingItem>) {
    setItems((prev) => prev.map((it) =>
      it.id === id ? { ...it, ...patch, metadataTouched: true } : it
    ));
  }

  async function save(item: PendingItem) {
    if (!item.upload) return;
    if (!item.existing && !item.name.trim()) {
      updateItem(item.id, { errorMsg: 'Vehicle name is required.' });
      return;
    }
    updateItem(item.id, { status: 'saving', errorMsg: undefined });

    const payload: Record<string, unknown> = {
      photo: {
        storage_path:   item.upload.storage_path,
        thumbnail_path: item.upload.thumbnail_path,
        blurhash:       item.upload.blurhash,
        width:          item.upload.width,
        height:         item.upload.height,
        location_taken: item.location.trim() || null,
        date_taken:     item.date || null,
      },
    };
    if (item.existing) {
      payload.vehicle_id = item.existing.id;
    } else {
      payload.vehicle = {
        name:   item.name.trim(),
        type:   item.type,
        era:    item.era,
        nation: item.nation.trim() || null,
      };
    }

    const res = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      updateItem(item.id, { status: 'error', errorMsg: body.error ?? res.statusText });
      return;
    }
    updateItem(item.id, { status: 'saved' });
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  const [savingAll, setSavingAll] = useState(false);
  const readyItems   = items.filter((i) => i.status === 'ready');
  const savableItems = items.filter((i) => i.status === 'ready' || i.status === 'error');
  const savedCount   = items.filter((i) => i.status === 'saved').length;
  const uploadingCount = items.filter((i) => i.status === 'uploading').length;
  const allDone      = items.length > 0 && items.every((i) => i.status === 'saved');

  async function saveAll() {
    setSavingAll(true);
    for (const item of readyItems) {
      if (!item.upload) continue;
      if (!item.existing && !item.name.trim()) continue;
      await save(item);
    }
    setSavingAll(false);
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={
          'cursor-pointer rounded-md border-2 border-dashed px-6 py-12 text-center transition-colors ' +
          (isDragActive
            ? 'border-zinc-400 bg-zinc-900'
            : 'border-zinc-800 hover:border-zinc-700')
        }
      >
        <input {...getInputProps()} />
        <p className="text-sm text-zinc-400">
          {isDragActive ? 'Drop them here…' : 'Drag photos here, or click to select.'}
        </p>
        <p className="mt-1 text-xs text-zinc-600">JPG, PNG, WebP — up to 200 at a time. Gemini auto-fills metadata.</p>
      </div>

      {items.length > 0 && (
        <div className="mt-6 space-y-4">
          {/* Progress bar + bulk actions */}
          <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3">
            <div className="text-sm text-zinc-400">
              {uploadingCount > 0 && (
                <span>Processing {uploadingCount}… </span>
              )}
              {savedCount > 0 && (
                <span className="text-emerald-400">{savedCount} saved</span>
              )}
              {savableItems.length > 0 && (
                <span> · {savableItems.length} ready to save</span>
              )}
              {items.length > 0 && (
                <span className="text-zinc-600"> · {items.length} total</span>
              )}
            </div>
            <div className="flex gap-2">
              {readyItems.length > 1 && (
                <button
                  onClick={saveAll}
                  disabled={savingAll}
                  className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                >
                  {savingAll ? `Saving ${readyItems.length}…` : `Save all (${readyItems.length})`}
                </button>
              )}
              {allDone && (
                <button
                  onClick={() => router.push('/admin')}
                  className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white"
                >
                  Done — back to dashboard
                </button>
              )}
            </div>
          </div>

          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onChange={(patch) => touchMetadata(item.id, patch)}
              onAttachExisting={(v) => updateItem(item.id, {
                existing: v,
                name: v.name,
                type: v.type,
                era: v.era,
                nation: v.nation ?? '',
                metadataTouched: true,
                errorMsg: undefined,
              })}
              onDetachExisting={() => updateItem(item.id, { existing: undefined })}
              onSave={() => save(item)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

async function uploadOne(
  item: PendingItem,
  setItems: React.Dispatch<React.SetStateAction<PendingItem[]>>
) {
  if (!item.file) return;
  try {
    const blob = await resizeImage(item.file, 3000, 0.92).catch(() => item.file!);
    const form = new FormData();
    form.append('file', blob, item.fileName);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) throw new Error(body.error ?? res.statusText);
    setItems((prev) => prev.map((it) => (it.id === item.id
      ? { ...it, status: 'ready', upload: body }
      : it)));
  } catch (e) {
    setItems((prev) => prev.map((it) => (it.id === item.id
      ? { ...it, status: 'error', errorMsg: e instanceof Error ? e.message : 'Upload failed' }
      : it)));
  }
}

async function classifyOne(
  item: PendingItem,
  setItems: React.Dispatch<React.SetStateAction<PendingItem[]>>
) {
  if (!item.file) return;
  const blob = await resizeImage(item.file, 1024, 0.8).catch(() => item.file!);
  const form = new FormData();
  form.append('file', blob, item.fileName);
  try {
    const res = await fetch('/api/classify', { method: 'POST', body: form });
    if (!res.ok) throw new Error('classify failed');
    const ai = (await res.json()) as AiSuggestion;

    setItems((prev) => prev.map((it) => {
      if (it.id !== item.id) return it;
      if (it.metadataTouched || it.existing) {
        return { ...it, ai, classifying: false };
      }

      // If AI matched an existing vehicle, auto-attach
      if (ai.existing_match) {
        return {
          ...it,
          ai,
          classifying: false,
          name:   ai.name,
          type:   ai.type,
          era:    ai.era,
          nation: ai.nation,
          metadataTouched: true,
          existing: {
            id:     ai.existing_match,
            name:   ai.name,
            type:   ai.type,
            era:    ai.era,
            nation: ai.nation || null,
          },
        };
      }

      return {
        ...it,
        ai,
        classifying: false,
        name:   ai.name,
        type:   ai.type,
        era:    ai.era,
        nation: ai.nation,
      };
    }));
  } catch {
    setItems((prev) => prev.map((it) =>
      it.id === item.id ? { ...it, classifying: false } : it
    ));
  }
}

interface CardProps {
  item: PendingItem;
  onChange: (patch: Partial<PendingItem>) => void;
  onAttachExisting: (v: ExistingVehicle) => void;
  onDetachExisting: () => void;
  onSave: () => void;
  onRemove: () => void;
}

function ItemCard({ item, onChange, onAttachExisting, onDetachExisting, onSave, onRemove }: CardProps) {
  // For restored items (no File object), show the uploaded thumbnail from Supabase.
  const imgSrc = item.previewUrl
    ?? (item.upload?.thumbnail_path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${item.upload.thumbnail_path}`
      : undefined);

  return (
    <div className="flex gap-4 rounded-md border border-zinc-800 bg-zinc-950 p-4">
      {imgSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgSrc} alt={item.fileName} className="h-32 w-32 flex-shrink-0 rounded object-cover" />
      )}
      {!imgSrc && (
        <div className="flex h-32 w-32 flex-shrink-0 items-center justify-center rounded bg-zinc-900 text-xs text-zinc-600">
          Restored
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-zinc-500">{item.fileName}</span>
          <div className="flex items-center gap-2">
            {item.classifying && (
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">ai thinking…</span>
            )}
            {item.ai && (
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">ai: {item.ai.confidence}</span>
            )}
            <StatusPill status={item.status} />
          </div>
        </div>

        {item.status === 'uploading' && (
          <p className="text-xs text-zinc-500">Processing image…</p>
        )}

        {(item.status === 'ready' || item.status === 'saving' || item.status === 'error') && (
          <>
            {item.existing && (
              <div className="flex items-center justify-between rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs">
                <span className="text-emerald-300">
                  Attaching to existing: <strong className="text-emerald-100">{item.existing.name}</strong>
                </span>
                <button
                  onClick={onDetachExisting}
                  className="text-emerald-400 underline-offset-4 hover:text-emerald-200 hover:underline"
                >
                  × change
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <NameAutocomplete
                value={item.name}
                onChange={(v) => onChange({ name: v })}
                onPick={onAttachExisting}
                disabled={Boolean(item.existing)}
              />
              <Input
                placeholder="Nation (e.g. USA)"
                value={item.nation}
                onChange={(v) => onChange({ nation: v })}
                disabled={Boolean(item.existing)}
              />
              <Select
                value={item.type}
                onChange={(v) => onChange({ type: v as VehicleType })}
                options={VEHICLE_TYPES.map((t) => ({ value: t, label: VEHICLE_TYPE_LABELS[t] }))}
                disabled={Boolean(item.existing)}
              />
              <Select
                value={item.era}
                onChange={(v) => onChange({ era: v as VehicleEra })}
                options={VEHICLE_ERAS.map((e) => ({ value: e, label: VEHICLE_ERA_LABELS[e] }))}
                disabled={Boolean(item.existing)}
              />
              <Input
                placeholder="Location (museum, site)"
                value={item.location}
                onChange={(v) => onChange({ location: v })}
              />
              <Input
                type="date"
                value={item.date}
                onChange={(v) => onChange({ date: v })}
              />
            </div>

            {item.ai && (
              <p className="text-[11px] text-zinc-500">
                Gemini suggested: <span className="text-zinc-300">{item.ai.name}</span>
                {' · '}{VEHICLE_TYPE_LABELS[item.ai.type]}
                {' · '}{VEHICLE_ERA_LABELS[item.ai.era]}
                {item.ai.nation ? ` · ${item.ai.nation}` : ''}
              </p>
            )}

            {item.errorMsg && (
              <p className="text-xs text-red-400">{item.errorMsg}</p>
            )}

            <div className="mt-1 flex gap-2">
              <button
                onClick={onSave}
                disabled={item.status === 'saving'}
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
              >
                {item.status === 'saving' ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={onRemove}
                className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
              >
                Remove
              </button>
            </div>
          </>
        )}

        {item.status === 'saved' && (
          <p className="text-xs text-emerald-400">Saved.</p>
        )}
      </div>
    </div>
  );
}

interface AutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  onPick: (v: ExistingVehicle) => void;
  disabled?: boolean;
}

function NameAutocomplete({ value, onChange, onPick, disabled }: AutocompleteProps) {
  const [suggestions, setSuggestions] = useState<ExistingVehicle[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function fetchSuggestions(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vehicles?q=${encodeURIComponent(q.trim())}`);
        if (!res.ok) return;
        const data = (await res.json()) as ExistingVehicle[];
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        // silent
      }
    }, 250);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder="Vehicle name *"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          fetchSuggestions(e.target.value);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:opacity-50"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-lg">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                  setSuggestions([]);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-900"
              >
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-zinc-500">
                  {VEHICLE_TYPE_LABELS[s.type]} · {VEHICLE_ERA_LABELS[s.era]}
                  {s.nation ? ` · ${s.nation}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Input(props: {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={props.type ?? 'text'}
      placeholder={props.placeholder}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
      className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:opacity-50"
    />
  );
}

function Select(props: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
      className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none disabled:opacity-50"
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    uploading: { label: 'uploading',  cls: 'bg-zinc-800 text-zinc-300' },
    ready:     { label: 'ready',      cls: 'bg-amber-900 text-amber-200' },
    saving:    { label: 'saving',     cls: 'bg-zinc-800 text-zinc-300' },
    saved:     { label: 'saved',      cls: 'bg-emerald-900 text-emerald-200' },
    error:     { label: 'error',      cls: 'bg-red-900 text-red-200' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}
