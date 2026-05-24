'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { VEHICLE_ERA_LABELS, VEHICLE_TYPE_LABELS } from '@/lib/constants';
import type { VehicleEra, VehicleType } from '@/types';

interface Result {
  name: string;
  type: VehicleType;
  era: VehicleEra;
  nation: string;
  confidence: 'high' | 'medium' | 'low';
}

// Client-side throttle: limit one classify per N seconds to protect the
// shared Gemini free-tier quota from accidental rapid-fire uploads.
const COOLDOWN_MS = 6_000;

export function IdentifyClient() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status,     setStatus]     = useState<'idle' | 'classifying' | 'done' | 'error'>('idle');
  const [result,     setResult]     = useState<Result | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;

    if (Date.now() < cooldownUntil) {
      const wait = Math.ceil((cooldownUntil - Date.now()) / 1000);
      setError(`Slow down — try again in ${wait}s.`);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setStatus('classifying');
    setResult(null);
    setError(null);

    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/classify', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setResult(body);
      setStatus('done');
      setCooldownUntil(Date.now() + COOLDOWN_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Classification failed');
      setStatus('error');
    }
  }, [previewUrl, cooldownUntil]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
    maxSize: 5 * 1024 * 1024,
  });

  return (
    <div className="space-y-6">
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
          {isDragActive ? 'Drop it here…' : 'Drag a photo here, or click to select.'}
        </p>
        <p className="mt-1 text-xs text-zinc-600">JPG, PNG, WebP — max 5 MB.</p>
      </div>

      {previewUrl && (
        <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="upload preview"
            className="max-h-96 w-full rounded object-contain"
          />

          {status === 'classifying' && (
            <p className="text-sm text-zinc-400">Identifying…</p>
          )}

          {status === 'done' && result && (
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <h2 className="text-xl font-semibold text-zinc-100">{result.name}</h2>
                <span className={
                  'rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ' +
                  (result.confidence === 'high'   ? 'bg-emerald-900 text-emerald-200' :
                   result.confidence === 'medium' ? 'bg-amber-900 text-amber-200'     :
                                                   'bg-zinc-800 text-zinc-300')
                }>
                  {result.confidence} confidence
                </span>
              </div>
              <p className="text-sm text-zinc-400">
                {VEHICLE_TYPE_LABELS[result.type]} · {VEHICLE_ERA_LABELS[result.era]}
                {result.nation ? ` · ${result.nation}` : ''}
              </p>
            </div>
          )}

          {status === 'error' && error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>
      )}

      {error && !previewUrl && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <p className="text-xs text-zinc-600">
        Powered by Gemini 2.5 Flash. Free tier (~250 requests/day) is shared with the
        whole site, so be gentle.
      </p>
    </div>
  );
}
