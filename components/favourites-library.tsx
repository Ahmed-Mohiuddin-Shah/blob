"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { FavoriteUiType } from "@/lib/favorites";
import { FavouriteButton } from "./favourite-button";
import { StickerMedia } from "./sticker-media";

type FavItem = {
  id: string;
  subjectType: FavoriteUiType;
  subjectId: string;
  title: string;
  href: string;
  thumbUrl: string | null;
  type: string;
  author: string;
  stickerCount?: number;
};

export function FavouritesLibrary({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(initialQ);
  const [items, setItems] = useState<FavItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, replace: boolean, query: string) => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/favourites?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = (await res.json()) as {
        items: FavItem[];
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
      .catch(() => setError("Could not load favourites"))
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
    router.push(qs ? `/profile/favourites?${qs}` : "/profile/favourites");
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Favourites</h1>
      <p className="mt-1 text-sm text-secondary">
        Private bookmarks — stickers, collections, sheets, and packs you want to
        find again.
      </p>

      <form onSubmit={submit} className="mt-6 max-w-md">
        <div className="flex items-center rounded-full border border-divider bg-surface p-1">
          <div className="flex h-9 w-9 items-center justify-center text-inactive">
            <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search favourites…"
            className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-inactive"
            autoComplete="off"
          />
        </div>
      </form>

      {error ? (
        <p className="mt-6 text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-16 text-center text-sm text-secondary">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-secondary">
          No favourites yet. Tap the heart on a sticker or collection.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-4 rounded-[1.5rem] border border-divider bg-surface p-3"
            >
              <Link
                href={item.href}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-background"
              >
                {item.thumbUrl ? (
                  <StickerMedia
                    src={item.thumbUrl}
                    seed={item.title}
                    alt={item.title}
                    video={item.type === "VIDEO"}
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] font-bold uppercase text-inactive">
                    Col
                  </span>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  className="block truncate text-sm font-semibold hover:text-accent-pink"
                >
                  {item.title}
                </Link>
                <p className="mt-0.5 text-xs text-secondary">
                  {item.type}
                  {item.stickerCount != null
                    ? ` · ${item.stickerCount} stickers`
                    : ""}{" "}
                  · {item.author}
                </p>
              </div>
              <FavouriteButton
                subjectType={item.subjectType}
                subjectId={item.subjectId}
                initialFavourited
                signedIn
                variant="icon"
              />
            </li>
          ))}
        </ul>
      )}

      <div ref={loadMoreRef} className="h-8" aria-hidden />
      {loadingMore ? (
        <p className="pb-8 text-center text-xs text-secondary">Loading more…</p>
      ) : null}
    </div>
  );
}
