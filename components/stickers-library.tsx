"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StickerGrid } from "./sticker-grid";
import type { StickerCardProps } from "./sticker-card";
import {
  LibrarySearch,
  LibrarySearchSentinel,
  useSearchDock,
} from "./library-search";
import type { CategoryPill } from "./category-pills";

type ApiItem = StickerCardProps & { id: string };

export function StickersLibrary({
  categories,
  initialQ,
  initialCategory,
}: {
  categories: CategoryPill[];
  initialQ: string;
  initialCategory: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const docked = useSearchDock(sentinelRef);

  const [items, setItems] = useState<StickerCardProps[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, replace: boolean) => {
      const params = new URLSearchParams();
      if (initialQ) params.set("q", initialQ);
      if (initialCategory) params.set("category", initialCategory);
      if (nextCursor) params.set("cursor", nextCursor);

      const res = await fetch(`/api/stickers?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = (await res.json()) as {
        items: ApiItem[];
        nextCursor: string | null;
      };
      setItems((prev) => (replace ? json.items : [...prev, ...json.items]));
      setCursor(json.nextCursor);
    },
    [initialQ, initialCategory],
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

  return (
    <>
      {docked ? (
        <div className="sticky top-20 z-30 border-b border-divider bg-background/90 px-5 py-2 backdrop-blur-md sm:px-8">
          <div className="mx-auto flex w-full max-w-7xl justify-center">
            <LibrarySearch
              categories={categories}
              initialQ={initialQ}
              initialCategory={initialCategory || undefined}
              docked
            />
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex min-h-[28vh] flex-col justify-end pb-8 pt-10 sm:min-h-[32vh] sm:pt-14">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
            Library
          </p>
          <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-5xl">
            Stickers
          </h1>
          <div className="mt-8">
            <LibrarySearch
              categories={categories}
              initialQ={initialQ}
              initialCategory={initialCategory || undefined}
              docked={false}
            />
          </div>
          <LibrarySearchSentinel sentinelRef={sentinelRef} />
        </div>

        {error ? (
          <p className="py-8 text-center text-sm text-accent-orange" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="py-16 text-center text-sm text-secondary">Loading…</p>
        ) : (
          <StickerGrid items={items} />
        )}

        <div ref={loadMoreRef} className="h-8" aria-hidden />
        {loadingMore ? (
          <p className="pb-12 text-center text-xs text-secondary">Loading more…</p>
        ) : null}
      </div>
    </>
  );
}
