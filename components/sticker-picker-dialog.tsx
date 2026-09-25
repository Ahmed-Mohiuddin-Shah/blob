"use client";

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BusyButton } from "./busy-button";
import { MAX_SHEET_STICKERS } from "@/lib/prints";
import { VISIBILITY } from "@/lib/stickers";

export type PickerSticker = {
  id: string;
  title: string;
  slug: string;
  thumbUrl: string;
  fullUrl: string;
  visibility: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  selected: PickerSticker[];
  onConfirm: (selected: PickerSticker[]) => void;
  max?: number;
};

export function StickerPickerDialog({
  open,
  onClose,
  selected: initial,
  onConfirm,
  max = MAX_SHEET_STICKERS,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"public" | "mine">("public");
  const [results, setResults] = useState<PickerSticker[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Map<string, PickerSticker>>(
    () => new Map(initial.map((s) => [s.id, s])),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setSelected(new Map(initial.map((s) => [s.id, s])));
  }, [open, initial]);

  const search = useCallback(
    async (query: string, which: "public" | "mine") => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (which === "mine") params.set("mine", "1");
        const res = await fetch(`/api/stickers?${params}`);
        if (!res.ok) throw new Error("search failed");
        const json = (await res.json()) as {
          items: {
            id: string;
            title: string;
            slug: string;
            visibility?: string;
            thumbUrl?: string;
          }[];
        };
        setResults(
          json.items.map((s) => ({
            id: s.id,
            title: s.title,
            slug: s.slug,
            visibility: s.visibility ?? VISIBILITY.public,
            thumbUrl: s.thumbUrl ?? `/api/stickers/${s.id}/media/thumbnail`,
            fullUrl: `/api/stickers/${s.id}/media/image`,
          })),
        );
      } catch {
        setError("Could not search stickers");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void search(q.trim(), tab), 200);
    return () => clearTimeout(t);
  }, [open, q, tab, search]);

  if (!mounted || !open) return null;

  const selectedList = [...selected.values()];
  const hasNonPublic = selectedList.some(
    (s) => s.visibility !== VISIBILITY.public,
  );

  function toggle(s: PickerSticker) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(s.id)) {
        next.delete(s.id);
      } else {
        if (next.size >= max) return prev;
        next.set(s.id, s);
      }
      return next;
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-label="Pick stickers"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-divider bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-pink">
              Stickers
            </p>
            <h2 className="text-lg font-semibold">
              Pick up to {max} ({selected.size}/{max})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-secondary hover:bg-badge"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex gap-2 px-5 pt-3">
          {(["public", "mine"] as const).map((t) => (
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
              {t === "public" ? "Library" : "Mine"}
            </button>
          ))}
        </div>

        <div className="px-5 pt-3">
          <div className="flex items-center rounded-full border border-divider bg-background p-1">
            <Search className="ml-3 h-4 w-4 text-inactive" strokeWidth={1.75} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stickers…"
              className="w-full bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
          <p className="mt-2 text-xs text-secondary">
            Max {max} stickers per sheet.
            {hasNonPublic ? (
              <span className="text-accent-orange">
                {" "}
                Selection includes private/unlisted stickers — their artwork
                will appear on a public sheet.
              </span>
            ) : null}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="text-sm text-accent-orange" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-[1.25rem] bg-badge"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {results.map((s) => {
                const on = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s)}
                    className={`relative overflow-hidden rounded-[1.25rem] border-2 transition ${
                      on
                        ? "border-accent-pink"
                        : "border-transparent hover:border-divider"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.thumbUrl}
                      alt=""
                      className="aspect-square w-full object-cover bg-badge"
                    />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-[10px] text-white">
                      {s.title}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-divider px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-semibold text-secondary"
          >
            Cancel
          </button>
          <BusyButton
            type="button"
            disabled={selected.size < 1}
            onClick={() => onConfirm(selectedList)}
            className="rounded-full bg-accent-gradient px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Use {selected.size || ""} sticker{selected.size === 1 ? "" : "s"}
          </BusyButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
