import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocationCounts } from '@/lib/supabase/queries';
import { MUSEUMS, matchesMuseum } from '@/lib/museums';
import type { Museum } from '@/lib/museums';

export const metadata: Metadata = {
  title:       'Museums',
  description: 'Military museums visited, and the ones still on the list.',
};

export const dynamic = 'force-dynamic';

export default async function MuseumsPage() {
  const locations = await getLocationCounts();

  // Visited status comes from the archive, not a hand-kept boolean. Every
  // location is also checked against the curated list so anywhere photographed
  // but unlisted surfaces below instead of silently going missing.
  const claimed = new Set<string>();
  const countFor = (m: Museum) => {
    let total = 0;
    // Track which location strings this entry covers, not just the total. A
    // curated museum can absorb several (Imperial War Museum matches both its
    // London and Duxford sites), and that decides how it can be linked.
    const matched: string[] = [];
    for (const { location, count } of locations) {
      if (matchesMuseum(m, location)) {
        total += count;
        matched.push(location);
        claimed.add(location);
      }
    }
    return { total, matched };
  };

  const withCounts = MUSEUMS.map((region) => ({
    region: region.region,
    museums: region.museums.map((m) => {
      const { total, matched } = countFor(m);
      return { museum: m, photos: total, matched };
    }),
  }));

  const all = withCounts.flatMap((r) => r.museums);
  const visited = all.filter((m) => m.photos > 0).length;
  const unlisted = locations.filter((l) => !claimed.has(l.location));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Museums</h1>
          <p className="mt-1 text-sm tabular-nums text-zinc-500">
            {visited} of {all.length} visited · {locations.length} places photographed
          </p>
        </div>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-100">&larr; Gallery</Link>
      </div>

      {withCounts.map((region) => (
        <section key={region.region} className="mb-10">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
            {region.region}
          </h2>
          <div className="space-y-1">
            {region.museums.map(({ museum: m, photos, matched }) => {
              const been = photos > 0;
              // The exact location filter is precise, but only works when this
              // entry maps to a single location string. Sites spanning several
              // (or none yet) fall back to the fuzzy search that always worked.
              const href = matched.length === 1
                ? `/?location=${encodeURIComponent(matched[0])}`
                : `/?q=${encodeURIComponent(m.match[0])}`;
              return (
                <div
                  key={m.name}
                  className={
                    'group rounded-lg border px-4 py-3 transition-colors ' +
                    (been
                      ? 'border-zinc-800/50 bg-zinc-900/30'
                      : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700')
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {been && (
                          <span className="flex-shrink-0 text-emerald-500" title="Visited">&#10003;</span>
                        )}
                        <h3 className="text-sm font-medium text-zinc-100">
                          {m.flag} {m.name}
                        </h3>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {m.city}, {m.country}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        {m.description}
                      </p>
                      {been && (
                        <Link
                          href={href}
                          className="mt-1.5 inline-block text-xs text-emerald-500/80 transition-colors hover:text-emerald-400"
                        >
                          {photos} photo{photos === 1 ? '' : 's'} &rarr;
                        </Link>
                      )}
                    </div>
                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-xs text-zinc-600 transition-colors hover:text-zinc-300"
                        aria-label={`${m.name} website`}
                      >
                        ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {unlisted.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Also photographed
          </h2>
          <p className="mb-4 text-xs text-zinc-600">
            Places in the archive that aren’t on the curated list yet.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unlisted.map((l) => (
              <Link
                key={l.location}
                href={`/?location=${encodeURIComponent(l.location)}`}
                className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
              >
                {l.location}
                <span className="tabular-nums text-zinc-600">{l.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-zinc-600">
        Visited status is derived from photo locations — nothing to tick off by hand.
        Add bucket-list entries in <code className="rounded bg-zinc-900 px-1 py-0.5">src/lib/museums.ts</code>.
      </p>
    </main>
  );
}
