import type { Metadata } from 'next';
import Link from 'next/link';
import { getStats } from '@/lib/supabase/queries';
import { VEHICLE_ERA_LABELS, VEHICLE_TYPE_LABELS } from '@/lib/constants';
import type { VehicleEra, VehicleType } from '@/types';

export const metadata: Metadata = {
  title:       'Stats',
  description: 'Collection statistics — counts by era, type, and nation.',
};

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const stats = await getStats();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100">← Gallery</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock label="Vehicles"  value={stats.totalVehicles} />
        <StatBlock label="Photos"    value={stats.totalPhotos} />
        <StatBlock label="Eras"      value={stats.byEra.length} />
        <StatBlock label="Nations"   value={stats.byNation.length} />
      </div>

      <Section title="By era">
        {stats.byEra.map((row) => (
          <Row
            key={row.key}
            label={VEHICLE_ERA_LABELS[row.key as VehicleEra] ?? row.key}
            count={row.count}
            max={stats.totalVehicles}
          />
        ))}
      </Section>

      <Section title="By type">
        {stats.byType.map((row) => (
          <Row
            key={row.key}
            label={VEHICLE_TYPE_LABELS[row.key as VehicleType] ?? row.key}
            count={row.count}
            max={stats.totalVehicles}
          />
        ))}
      </Section>

      {stats.byNation.length > 0 && (
        <Section title="By nation">
          {stats.byNation.slice(0, 10).map((row) => (
            <Row key={row.key} label={row.key} count={row.count} max={stats.totalVehicles} />
          ))}
        </Section>
      )}

      {stats.mostPhotographed.length > 0 && (
        <Section title="Most photographed">
          <ul className="divide-y divide-zinc-800">
            {stats.mostPhotographed.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2">
                <Link href={`/?photo=${v.id}`} className="text-sm text-zinc-200 hover:underline">
                  {v.name}
                </Link>
                <span className="text-sm tabular-nums text-zinc-500">{v.count} photos</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </main>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 py-1.5">
      <span className="truncate text-sm text-zinc-300">{label}</span>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-900">
        <div className="absolute inset-y-0 left-0 bg-zinc-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-right text-sm tabular-nums text-zinc-500">{count}</span>
    </div>
  );
}
