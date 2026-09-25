"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FavouriteButton } from "./favourite-button";
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
  mine = false,
}: {
  signedIn?: boolean;
  /** Show the signed-in user's sheets/packs (all statuses). */
  mine?: boolean;
}) {
  const [tab, setTab] = useState<"sheets" | "packs">("sheets");
  const [sheets, setSheets] = useState<SheetItem[]>([]);
  const [packs, setPacks] = useState<PackItem[]>([]);
  const [sheetCursor, setSheetCursor] = useState<string | null>(null);
  const [packCursor, setPackCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadSheets = useCallback(async (cursor: string | null, replace: boolean) => {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (mine) params.set("mine", "1");
    const res = await fetch(`/api/sheets?${params}`);
    if (!res.ok) throw new Error("fail");
    const json = (await res.json()) as {
      items: SheetItem[];
      nextCursor: string | null;
    };
    setSheets((prev) => (replace ? json.items : [...prev, ...json.items]));
    setSheetCursor(json.nextCursor);
  }, [mine]);

  const loadPacks = useCallback(async (cursor: string | null, replace: boolean) => {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (mine) params.set("mine", "1");
    const res = await fetch(`/api/packs?${params}`);
    if (!res.ok) throw new Error("fail");
    const json = (await res.json()) as {
      items: PackItem[];
      nextCursor: string | null;
    };
    setPacks((prev) => (replace ? json.items : [...prev, ...json.items]));
    setPackCursor(json.nextCursor);
  }, [mine]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSheets(null, true), loadPacks(null, true)])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadSheets, loadPacks]);

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
            ? loadSheets(cursor, false)
            : loadPacks(cursor, false);
        p.catch(() => {}).finally(() => setLoadingMore(false));
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadPacks, loadSheets, loadingMore, tab]);

  const items = tab === "sheets" ? sheets : packs;

  return (
    <div>
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
                  subjectId={s.id}
                  favourited={!!s.favourited}
                  signedIn={signedIn}
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
                  subjectId={p.id}
                  favourited={!!p.favourited}
                  signedIn={signedIn}
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
  subjectId,
  favourited,
  signedIn,
}: {
  href: string;
  title: string;
  previewUrl: string | null;
  meta?: string;
  status?: string;
  subjectType: typeof FAVORITE_SUBJECT.stickerSheet | typeof FAVORITE_SUBJECT.stickerPack;
  subjectId: string;
  favourited: boolean;
  signedIn: boolean;
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
      <div className="absolute right-2 top-2">
        <FavouriteButton
          subjectType={subjectType}
          subjectId={subjectId}
          initialFavourited={favourited}
          signedIn={signedIn}
          variant="icon"
        />
      </div>
    </article>
  );
}
