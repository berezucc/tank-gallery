'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { publicPhotoUrl } from '@/lib/storage';
import {
  VEHICLE_ERAS,
  VEHICLE_ERA_LABELS,
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
} from '@/lib/constants';
import type { VehicleEra, VehicleType } from '@/types';

interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  era: VehicleEra;
  nation: string | null;
}

interface Props {
  photoId: string;
  storagePath: string;
  thumbnailPath: string | null;
  vehicle: Vehicle | null;
}

export function PhotoRow({ photoId, storagePath, thumbnailPath, vehicle }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [name,    setName]    = useState(vehicle?.name   ?? '');
  const [type,    setType]    = useState<VehicleType>(vehicle?.type ?? 'other');
  const [era,     setEra]     = useState<VehicleEra>(vehicle?.era  ?? 'other');
  const [nation,  setNation]  = useState(vehicle?.nation ?? '');
  const [error,   setError]   = useState<string | null>(null);

  async function onSave() {
    if (!vehicle) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/vehicles/${vehicle.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, era, nation: nation.trim() || null }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? res.statusText);
      setBusy(false);
      return;
    }
    setEditing(false);
    setBusy(false);
    router.refresh();
  }

  function onCancel() {
    setName(vehicle?.name ?? '');
    setType(vehicle?.type ?? 'other');
    setEra(vehicle?.era ?? 'other');
    setNation(vehicle?.nation ?? '');
    setError(null);
    setEditing(false);
  }

  async function onDelete() {
    if (!confirm('Delete this photo?')) return;
    setBusy(true);
    const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Delete failed: ${body.error ?? res.statusText}`);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <tr className="hover:bg-zinc-950 align-top">
      <td className="px-3 py-2">
        <div className="relative h-12 w-16 overflow-hidden rounded bg-zinc-900">
          <Image
            src={publicPhotoUrl(thumbnailPath ?? storagePath)}
            alt={vehicle?.name ?? 'photo'}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
      </td>

      {editing && vehicle ? (
        <>
          <td className="px-3 py-2" colSpan={4}>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <input value={name}   onChange={(e) => setName(e.target.value)}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none" />
              <select value={type} onChange={(e) => setType(e.target.value as VehicleType)}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none">
                {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{VEHICLE_TYPE_LABELS[t]}</option>)}
              </select>
              <select value={era} onChange={(e) => setEra(e.target.value as VehicleEra)}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none">
                {VEHICLE_ERAS.map((e) => <option key={e} value={e}>{VEHICLE_ERA_LABELS[e]}</option>)}
              </select>
              <input value={nation} onChange={(e) => setNation(e.target.value)} placeholder="nation"
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none" />
            </div>
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          </td>
          <td className="px-3 py-2 text-right">
            <div className="flex justify-end gap-2">
              <button onClick={onSave} disabled={busy}
                className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50">
                {busy ? '…' : 'Save'}
              </button>
              <button onClick={onCancel} disabled={busy}
                className="text-xs text-zinc-500 hover:text-zinc-200">
                Cancel
              </button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="px-3 py-2 font-medium text-zinc-100">
            {vehicle?.name ?? <span className="text-zinc-500">—</span>}
          </td>
          <td className="px-3 py-2 text-zinc-400">
            {vehicle ? VEHICLE_TYPE_LABELS[vehicle.type] : '—'}
          </td>
          <td className="px-3 py-2 text-zinc-400">
            {vehicle ? VEHICLE_ERA_LABELS[vehicle.era] : '—'}
          </td>
          <td className="px-3 py-2 text-zinc-400">
            {vehicle?.nation ?? '—'}
          </td>
          <td className="px-3 py-2 text-right">
            <div className="flex justify-end gap-3">
              {vehicle && (
                <button onClick={() => setEditing(true)}
                  className="text-xs text-zinc-500 hover:text-zinc-200">
                  Edit
                </button>
              )}
              <button onClick={onDelete} disabled={busy}
                className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-50">
                {busy ? '…' : 'Delete'}
              </button>
            </div>
          </td>
        </>
      )}
    </tr>
  );
}
