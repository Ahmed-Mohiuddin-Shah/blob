"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { CollectionCard, type CollectionCardProps } from "./collection-card";
import { LibrarySearchSentinel, useSearchDock } from "./library-search";
import { StickerGridSkeleton } from "./skeleton";

type ApiItem = CollectionCardProps & { id: string; slug: string };

export function CollectionsLibrary({
  initialQ,
  signedIn = false,
  signInHref,
}: {
  initialQ: string;
  signedIn?: boolean;
  signInHref?: string;
}) {
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
      const mapped = json.items.map((item) => ({
        ...item,
        favourited: !!item.favourited,
        signedIn,
        signInHref,
        showActions: true,
      }));
      setItems((prev) => (replace ? mapped : [...prev, ...mapped]));
      setCursor(json.nextCursor);
    },
    [signedIn, signInHref],
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

  function submit(nextQ: string) {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    const qs = params.toString();
    router.push(qs ? `/collections?${qs}` : "/collections");
  }

  const searchForm = (dockedMode: boolean) => (
    <SearchBar
      variant="library"
      value={q}
      onChange={setQ}
      onSubmit={submit}
      showCamera
      hideSubmit={dockedMode}
      placeholder="Search collections or stickers inside…"
      className={dockedMode ? "w-full max-w-md" : "mx-auto max-w-2xl"}
    />
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
          <StickerGridSkeleton />
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-secondary">
            No collections yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 sm:gap-5">
            {items.map((item) => (
              <CollectionCard key={item.id} {...item} />
            ))}
          </div>
        )}

        <div ref={loadMoreRef} className="h-8" aria-hidden />
        {loadingMore ? (
          <div className="pb-12">
            <StickerGridSkeleton count={6} />
          </div>
        ) : null}
      </div>
    </>
  );
}
