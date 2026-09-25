"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StickerGrid } from "./sticker-grid";
import type { StickerCardProps } from "./sticker-card";

type Item = {
  id: string;
  title: string;
  slug: string;
  author: string;
  type: string;
  href: string;
  thumbUrl: string;
};

type Props = {
  /** e.g. /api/sheets/123/stickers */
  endpoint: string;
  title?: string;
};

export function PrintStickersInfiniteGrid({
  endpoint,
  title = "Stickers on this print",
}: Props) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, replace: boolean) => {
      const params = new URLSearchParams();
      if (nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(
        `${endpoint}${params.toString() ? `?${params}` : ""}`,
      );
      if (!res.ok) throw new Error("Failed to load");
      const json = (await res.json()) as {
        items: Item[];
        nextCursor: string | null;
      };
      setItems((prev) => (replace ? json.items : [...prev, ...json.items]));
      setCursor(json.nextCursor);
    },
    [endpoint],
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPage(null, true)
      .catch(() => setError("Could not load stickers"))
      .finally(() => setLoading(false));
  }, [fetchPage]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingMore) return;
        setLoadingMore(true);
        fetchPage(cursor, false)
          .catch(() => setError("Could not load more"))
          .finally(() => setLoadingMore(false));
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, fetchPage, loadingMore]);

  const cards: StickerCardProps[] = items.map((s) => ({
    title: s.title,
    href: s.href,
    thumbUrl: s.thumbUrl,
    author: s.author,
    type: s.type,
    stickerId: s.id,
  }));

  return (
    <section className="mt-16 border-t border-divider pt-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-pink">
        Stickers
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
      {error ? (
        <p className="mt-4 text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-[1.5rem] bg-badge"
            />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <StickerGrid items={cards} />
          <div ref={loadMoreRef} className="h-8" aria-hidden />
          {loadingMore ? (
            <p className="py-4 text-center text-sm text-secondary">Loading…</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
