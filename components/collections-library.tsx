"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CollectionCard, type CollectionCardProps } from "./collection-card";
import { LibrarySearchSentinel, useSearchDock } from "./library-search";

type ApiItem = CollectionCardProps & { id: string; slug: string };

export function CollectionsLibrary({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const docked = useSearchDock(sentinelRef);
  const [q, setQ] = useState(initialQ);

  const [items, setItems] = useState<ApiItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, replace: boolean, query: string) => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/collections?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = (await res.json()) as {
        items: ApiItem[];
        nextCursor: string | null;
      };
      setItems((prev) => (replace ? json.items : [...prev, ...json.items]));
      setCursor(json.nextCursor);
    },
    [],
  );

  useEffect(() => {
    setQ(initialQ);
    setLoading(true);
    setError(null);
    fetchPage(null, true, initialQ)
      .catch(() => setError("Could not load collections"))
      .finally(() => setLoading(false));
  }, [fetchPage, initialQ]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingMore) return;
        setLoadingMore(true);
        fetchPage(cursor, false, initialQ)
          .catch(() => setError("Could not load more"))
          .finally(() => setLoadingMore(false));
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, fetchPage, initialQ, loadingMore]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    router.push(qs ? `/collections?${qs}` : "/collections");
  }

  const searchForm = (dockedMode: boolean) => (
    <form
      onSubmit={submit}
      className={dockedMode ? "w-full max-w-md" : "mx-auto max-w-2xl"}
    >
      <div
        className={`group relative flex items-center rounded-full border border-divider bg-surface shadow-xl shadow-black/5 transition-all duration-300 focus-within:border-accent-pink/50 ${
          dockedMode ? "p-1" : "p-2"
        }`}
      >
        <div
          className={`flex shrink-0 items-center justify-center text-inactive ${
            dockedMode ? "h-9 w-9" : "h-12 w-12"
          }`}
        >
          <Search
            className={dockedMode ? "h-4 w-4" : "h-5 w-5"}
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search collections or stickers inside…"
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-inactive ${
            dockedMode ? "px-1 text-sm" : "px-2 text-base"
          }`}
          autoComplete="off"
        />
        {!dockedMode ? (
          <button
            type="submit"
            className="hidden rounded-full bg-accent-gradient px-6 py-3 text-sm font-semibold text-white sm:block"
          >
            Search
          </button>
        ) : null}
      </div>
    </form>
  );

  return (
    <>
      {docked ? (
        <div className="sticky top-20 z-30 border-b border-divider bg-background/90 px-5 py-2 backdrop-blur-md sm:px-8">
          <div className="mx-auto flex w-full max-w-7xl justify-center">
            {searchForm(true)}
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex min-h-[28vh] flex-col justify-end pb-8 pt-10 sm:min-h-[32vh] sm:pt-14">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
            Library
          </p>
          <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-5xl">
            Collections
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-secondary">
            Public named lists — always shared, uniquely named.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/collections/new"
              className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-accent-pink/20"
            >
              New collection
            </Link>
          </div>
          <div className="mt-8">{searchForm(false)}</div>
          <LibrarySearchSentinel sentinelRef={sentinelRef} />
        </div>

        {error ? (
          <p className="py-8 text-center text-sm text-accent-orange" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="py-16 text-center text-sm text-secondary">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-secondary">
            No collections yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-5">
            {items.map((item) => (
              <CollectionCard key={item.id} {...item} />
            ))}
          </div>
        )}

        <div ref={loadMoreRef} className="h-8" aria-hidden />
        {loadingMore ? (
          <p className="pb-12 text-center text-xs text-secondary">Loading more…</p>
        ) : null}
      </div>
    </>
  );
}
