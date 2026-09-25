"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AddToCollectionButton } from "./add-to-collection-button";
import { FavouriteButton } from "./favourite-button";
import { LibrarySearchSentinel, useSearchDock } from "./library-search";
import { COLLECTION_ITEM } from "@/lib/collections";
import { FAVORITE_SUBJECT } from "@/lib/favorites";

type SheetItem = {
  id: string;
  name: string;
  slug: string;
  href: string;
  previewUrl: string | null;
  author?: string;
  favourited?: boolean;
  stickerCount?: number;
  status?: string;
};

type PackItem = {
  id: string;
  name: string;
  slug: string;
  href: string;
  previewUrl: string | null;
  author?: string;
  favourited?: boolean;
  sheetCount?: number;
  status?: string;
};

export function PrintsLibrary({
  signedIn = false,
  signInHref = "/auth/login",
  mine = false,
  initialQ = "",
  /** When false, skip sticky dock + URL search (e.g. profile/prints). */
  searchable = true,
}: {
  signedIn?: boolean;
  signInHref?: string;
  /** Show the signed-in user's sheets/packs (all statuses). */
  mine?: boolean;
  initialQ?: string;
  searchable?: boolean;
}) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const docked = useSearchDock(sentinelRef);
  const [q, setQ] = useState(initialQ);
  const [tab, setTab] = useState<"sheets" | "packs">("sheets");
  const [sheets, setSheets] = useState<SheetItem[]>([]);
  const [packs, setPacks] = useState<PackItem[]>([]);
  const [sheetCursor, setSheetCursor] = useState<string | null>(null);
  const [packCursor, setPackCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadSheets = useCallback(
    async (cursor: string | null, replace: boolean, query: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (mine) params.set("mine", "1");
      if (query) params.set("q", query);
      const res = await fetch(`/api/sheets?${params}`);
      if (!res.ok) throw new Error("fail");
      const json = (await res.json()) as {
        items: SheetItem[];
        nextCursor: string | null;
      };
      setSheets((prev) => (replace ? json.items : [...prev, ...json.items]));
      setSheetCursor(json.nextCursor);
    },
    [mine],
  );

  const loadPacks = useCallback(
    async (cursor: string | null, replace: boolean, query: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (mine) params.set("mine", "1");
      if (query) params.set("q", query);
      const res = await fetch(`/api/packs?${params}`);
      if (!res.ok) throw new Error("fail");
      const json = (await res.json()) as {
        items: PackItem[];
        nextCursor: string | null;
      };
      setPacks((prev) => (replace ? json.items : [...prev, ...json.items]));
      setPackCursor(json.nextCursor);
    },
    [mine],
  );

  useEffect(() => {
    setQ(initialQ);
    setLoading(true);
    Promise.all([
      loadSheets(null, true, initialQ),
      loadPacks(null, true, initialQ),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadSheets, loadPacks, initialQ]);

  const cursor = tab === "sheets" ? sheetCursor : packCursor;

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingMore) return;
        setLoadingMore(true);
        const p =
          tab === "sheets"
            ? loadSheets(cursor, false, initialQ)
            : loadPacks(cursor, false, initialQ);
        p.catch(() => {}).finally(() => setLoadingMore(false));
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadPacks, loadSheets, loadingMore, tab, initialQ]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!searchable || mine) {
      setLoading(true);
      Promise.all([loadSheets(null, true, q.trim()), loadPacks(null, true, q.trim())])
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    router.push(qs ? `/prints?${qs}` : "/prints");
  }

  const searchForm = (dockedMode: boolean) => (
    <form
      onSubmit={submit}
      className={dockedMode ? "w-full max-w-md" : "w-full max-w-2xl"}
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
          placeholder="Search sheets and packs…"
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

  const items = tab === "sheets" ? sheets : packs;

  return (
    <div>
      {searchable && docked ? (
        <div className="sticky top-20 z-30 -mx-5 mb-4 border-b border-divider bg-background/90 px-5 py-2 backdrop-blur-md sm:-mx-8 sm:px-8">
          <div className="flex w-full justify-center">{searchForm(true)}</div>
        </div>
      ) : null}

      {searchable ? (
        <div className="mb-6">
          {searchForm(false)}
          <LibrarySearchSentinel sentinelRef={sentinelRef} />
        </div>
      ) : null}

      <div className="flex gap-2">
        {(["sheets", "packs"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide ${
              tab === t
                ? "bg-accent-gradient text-white"
                : "bg-badge text-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] animate-pulse rounded-[1.5rem] bg-badge"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-secondary">
          No {tab} yet.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tab === "sheets"
            ? sheets.map((s) => (
                <PrintCard
                  key={s.id}
                  href={s.href}
                  title={s.name}
                  previewUrl={s.previewUrl}
                  meta={
                    s.stickerCount != null
                      ? `${s.stickerCount} stickers`
                      : s.author
                  }
                  status={mine ? s.status : undefined}
                  subjectType={FAVORITE_SUBJECT.stickerSheet}
                  collectionType={COLLECTION_ITEM.stickerSheet}
                  subjectId={s.id}
                  favourited={!!s.favourited}
                  signedIn={signedIn}
                  signInHref={signInHref}
                />
              ))
            : packs.map((p) => (
                <PrintCard
                  key={p.id}
                  href={p.href}
                  title={p.name}
                  previewUrl={p.previewUrl}
                  meta={
                    p.sheetCount != null
                      ? `${p.sheetCount} sheets`
                      : p.author
                  }
                  status={mine ? p.status : undefined}
                  subjectType={FAVORITE_SUBJECT.stickerPack}
                  collectionType={COLLECTION_ITEM.stickerPack}
                  subjectId={p.id}
                  favourited={!!p.favourited}
                  signedIn={signedIn}
                  signInHref={signInHref}
                />
              ))}
        </div>
      )}
      <div ref={loadMoreRef} className="h-8" aria-hidden />
    </div>
  );
}

function PrintCard({
  href,
  title,
  previewUrl,
  meta,
  status,
  subjectType,
  collectionType,
  subjectId,
  favourited,
  signedIn,
  signInHref,
}: {
  href: string;
  title: string;
  previewUrl: string | null;
  meta?: string;
  status?: string;
  subjectType:
    | typeof FAVORITE_SUBJECT.stickerSheet
    | typeof FAVORITE_SUBJECT.stickerPack;
  collectionType:
    | typeof COLLECTION_ITEM.stickerSheet
    | typeof COLLECTION_ITEM.stickerPack;
  subjectId: string;
  favourited: boolean;
  signedIn: boolean;
  signInHref: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] border border-divider bg-surface">
      <Link href={href} className="block">
        <div className="aspect-[3/4] bg-badge">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-contain p-2"
            />
          ) : status && status !== "ready" ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
              <div className="h-16 w-12 animate-pulse rounded-xl bg-surface" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary">
                {status.replaceAll("_", " ")}
              </p>
            </div>
          ) : null}
        </div>
        <div className="p-3">
          <h3 className="truncate font-semibold">{title}</h3>
          {meta ? (
            <p className="mt-0.5 text-xs text-secondary">{meta}</p>
          ) : null}
        </div>
      </Link>
      {status && status !== "ready" ? (
        <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-badge px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-secondary">
          {status.replaceAll("_", " ")}
        </div>
      ) : null}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-2">
        <FavouriteButton
          subjectType={subjectType}
          subjectId={subjectId}
          initialFavourited={favourited}
          signedIn={signedIn}
          signInHref={signInHref}
          variant="icon"
        />
        {!status || status === "ready" ? (
          <AddToCollectionButton
            subjectType={collectionType}
            subjectId={subjectId}
            signedIn={signedIn}
            signInHref={signInHref}
            variant="icon"
          />
        ) : null}
      </div>
    </article>
  );
}
