"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { StickerMedia } from "./sticker-media";

type PreviewSticker = {
  id: string;
  title: string;
  href: string;
  thumbUrl: string | null;
};

type BlobberRow = {
  id: string;
  displayName: string;
  description: string | null;
  href: string;
  stickers: PreviewSticker[];
};

export function BlobbersDirectory({ initialQ }: { initialQ: string }) {
  const [q, setQ] = useState(initialQ);
  const [items, setItems] = useState<BlobberRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, replace: boolean, query: string) => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/blobbers?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as {
        items: BlobberRow[];
        nextCursor: string | null;
      };
      setItems((prev) => (replace ? json.items : [...prev, ...json.items]));
      setCursor(json.nextCursor);
    },
    [],
  );

  useEffect(() => {
    setLoading(true);
    fetchPage(null, true, q)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [fetchPage, q]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void fetchPage(cursor, false, q);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, fetchPage, q]);

  return (
    <div>
      <form
        className="mb-10"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setQ(String(fd.get("q") ?? "").trim());
        }}
      >
        <input
          name="q"
          defaultValue={initialQ}
          placeholder="Search Blobbers…"
          className="w-full max-w-md rounded-full border border-divider bg-surface px-5 py-3 text-sm outline-none focus:border-accent-pink/50"
        />
      </form>

      {loading ? (
        <p className="text-sm text-secondary">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-secondary">No Blobbers found.</p>
      ) : (
        <div className="space-y-12">
          {items.map((b) => (
            <section key={b.id}>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-inactive">
                    Blobber
                  </p>
                  <h2 className="text-2xl font-light lowercase tracking-tight text-foreground sm:text-3xl">
                    {b.displayName}
                  </h2>
                  {b.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-secondary">
                      {b.description}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={b.href}
                  className="shrink-0 text-sm font-semibold text-accent-pink hover:underline"
                >
                  View more →
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {b.stickers.map((s) => (
                  <Link
                    key={s.id}
                    href={s.href}
                    className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[1.5rem] border border-divider bg-surface"
                  >
                    <StickerMedia
                      src={s.thumbUrl}
                      seed={s.title}
                      alt={s.title}
                    />
                  </Link>
                ))}
                <Link
                  href={b.href}
                  className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[1.5rem] border border-dashed border-divider bg-surface text-center text-xs font-semibold text-accent-pink"
                >
                  View more
                </Link>
              </div>
            </section>
          ))}
          <div ref={loadMoreRef} className="h-8" />
        </div>
      )}
    </div>
  );
}
