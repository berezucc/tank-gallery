'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GalleryCard } from './GalleryCard';
import type { GridCard } from '@/types';

interface Props {
  initial: GridCard[];
  total: number;
  /** The page's active filters, forwarded verbatim so chunks match what is above them. */
  query: string;
  chunk: number;
}

export function GalleryGrid({ initial, total, query, chunk }: Props) {
  const [cards, setCards] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // A new filter re-renders the page with a fresh first chunk; reset to it
  // rather than appending the new results onto the old filter's cards.
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setCards(initial);
    setFailed(false);
  }

  const done = cards.length >= total;

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams(query);
      qs.set('kind', 'grid');
      qs.set('offset', String(cards.length));
      qs.set('limit', String(chunk));
      const res = await fetch(`/api/gallery?${qs}`);
      if (!res.ok) throw new Error(String(res.status));
      const data: { cards: GridCard[] } = await res.json();
      // Concurrent observer fires could append the same offset twice.
      setCards((prev) => {
        const seen = new Set(prev.map((c) => c.key));
        return [...prev, ...data.cards.filter((c) => !seen.has(c.key))];
      });
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [cards.length, chunk, done, loading, query]);

  // Fetch a screen early so the grid rarely shows a gap while scrolling.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || failed) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore(); },
      { rootMargin: '800px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [done, failed, loadMore]);

  if (cards.length === 0) {
    return (
      <div className="py-32 text-center text-sm text-zinc-600">
        No photos match these filters.
      </div>
    );
  }

  return (
    <>
      {/* Justified rows, not CSS columns. Multi-column fills top-to-bottom, so
          the second photo landed *below* the first rather than beside it and the
          bottom edge was always ragged. Here each item's flex-basis is its aspect
          ratio times the row height and flex-grow is its aspect ratio, so a row
          stretches to fill the width while keeping relative proportions intact.
          The ::after absorbs slack on the final row so one lone photo doesn't
          balloon to full width. */}
      <div className="flex flex-wrap gap-0.5 [--row-h:140px] after:grow-[9999] after:content-[''] sm:[--row-h:190px] lg:[--row-h:230px] 2xl:[--row-h:260px]">
        {cards.map((c) => (
          <div
            key={c.key}
            style={{
              flexGrow: c.aspect,
              flexBasis: `calc(var(--row-h) * ${c.aspect})`,
              height: 'var(--row-h)',
            }}
          >
            <GalleryCard card={c} />
          </div>
        ))}
      </div>

      {!done && (
        <div ref={sentinel} className="py-10 text-center text-xs text-zinc-600">
          {failed ? (
            <button onClick={() => { setFailed(false); void loadMore(); }} className="hover:text-zinc-300">
              Couldn&apos;t load more — retry
            </button>
          ) : (
            <span className="tabular-nums">{cards.length} of {total}</span>
          )}
        </div>
      )}
    </>
  );
}
