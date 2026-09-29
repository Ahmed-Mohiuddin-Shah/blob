"use client";

import { useMemo, useState, useTransition } from "react";
import { BusyButton } from "@/components/busy-button";

type Cat = { id: string; name: string; slug: string };
type StickerOpt = { id: string; title: string; slug: string };

type Props = {
  initialFeaturedIds: string[];
  initialCategoryIds: string[];
  categories: Cat[];
  stickers: StickerOpt[];
};

export function LandingCmsForm({
  initialFeaturedIds,
  initialCategoryIds,
  categories,
  stickers,
}: Props) {
  const [featuredIds, setFeaturedIds] = useState(initialFeaturedIds);
  const [categoryIds, setCategoryIds] = useState(initialCategoryIds);
  const [stickerQ, setStickerQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stickerById = useMemo(() => {
    const m = new Map(stickers.map((s) => [s.id, s]));
    return m;
  }, [stickers]);

  const filteredStickers = useMemo(() => {
    const q = stickerQ.trim().toLowerCase();
    if (!q) return stickers.slice(0, 40);
    return stickers
      .filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.id === q,
      )
      .slice(0, 40);
  }, [stickers, stickerQ]);

  function toggleFeatured(id: string) {
    setFeaturedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function moveFeatured(id: string, dir: -1 | 1) {
    setFeaturedIds((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function toggleCategory(id: string) {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function moveCategory(id: string, dir: -1 | 1) {
    setCategoryIds((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function save() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/landing", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            featuredStickerIds: featuredIds,
            categoryIds,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Save failed");
        setMessage("Landing config saved.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <div className="space-y-10">
      <section className="rounded-[28px] border border-divider bg-surface p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-inactive">
          Featured stickers
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Ordered list shown on the home page. Empty = latest public stickers.
        </p>

        {featuredIds.length ? (
          <ol className="mt-4 space-y-2">
            {featuredIds.map((id) => {
              const s = stickerById.get(id);
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-divider bg-background px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {s?.title ?? `Sticker #${id}`}
                    {s ? (
                      <span className="ml-2 text-xs text-inactive">
                        /{s.slug}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-xs text-secondary hover:text-foreground"
                    onClick={() => moveFeatured(id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-xs text-secondary hover:text-foreground"
                    onClick={() => moveFeatured(id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-xs text-accent-pink"
                    onClick={() => toggleFeatured(id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-inactive">Using auto latest stickers.</p>
        )}

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-inactive">
          Add sticker
          <input
            value={stickerQ}
            onChange={(e) => setStickerQ(e.target.value)}
            placeholder="Search title or slug…"
            className="mt-1 w-full rounded-2xl border border-divider bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent-pink/50"
          />
        </label>
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-divider">
          {filteredStickers.map((s) => {
            const on = featuredIds.includes(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => toggleFeatured(s.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface ${
                    on ? "text-accent-pink" : "text-secondary"
                  }`}
                >
                  <span className="truncate">{s.title}</span>
                  <span className="text-xs text-inactive">{on ? "✓" : "+"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-[28px] border border-divider bg-surface p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-inactive">
          Home categories
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Ordered category cards on the home page. Empty = first 6 root
          categories by sort order.
        </p>

        {categoryIds.length ? (
          <ol className="mt-4 space-y-2">
            {categoryIds.map((id) => {
              const c = categories.find((x) => x.id === id);
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-divider bg-background px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 font-medium">
                    {c?.name ?? `Category #${id}`}
                  </span>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-xs text-secondary hover:text-foreground"
                    onClick={() => moveCategory(id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-xs text-secondary hover:text-foreground"
                    onClick={() => moveCategory(id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-xs text-accent-pink"
                    onClick={() => toggleCategory(id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-inactive">Using auto root categories.</p>
        )}

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {categories.map((c) => {
            const on = categoryIds.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm ${
                    on
                      ? "border-accent-pink/40 bg-accent-gradient/10 text-accent-pink"
                      : "border-divider text-secondary hover:border-accent-pink/30"
                  }`}
                >
                  {c.name}
                  <span className="text-xs">{on ? "✓" : "+"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <BusyButton
          type="button"
          busy={pending}
          onClick={save}
          className="rounded-full bg-accent-gradient px-6 py-2.5 text-sm font-semibold text-white"
        >
          Save landing
        </BusyButton>
        {message ? <p className="text-sm text-secondary">{message}</p> : null}
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>
    </div>
  );
}
