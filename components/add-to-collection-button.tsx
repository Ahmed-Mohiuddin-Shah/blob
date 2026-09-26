"use client";

import { Check, PlayingCardsFan, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { COLLECTION_ITEM } from "@/lib/collections";
import { BusyButton } from "./busy-button";

type CollectionOption = {
  id: string;
  name: string;
  slug: string;
  stickerCount: number;
  itemCount?: number;
};

type Props = {
  /** Legacy: sticker only */
  stickerId?: string;
  subjectType?: string;
  subjectId?: string;
  initialInCollection?: boolean;
  signedIn: boolean;
  signInHref?: string;
  variant?: "icon" | "pill";
  className?: string;
};

export function AddToCollectionButton({
  stickerId,
  subjectType: subjectTypeProp,
  subjectId: subjectIdProp,
  initialInCollection = false,
  signedIn,
  signInHref = "/auth/login",
  variant = "icon",
  className = "",
}: Props) {
  const subjectType =
    subjectTypeProp ??
    (stickerId ? COLLECTION_ITEM.sticker : COLLECTION_ITEM.sticker);
  const subjectId = subjectIdProp ?? stickerId ?? "";

  const router = useRouter();
  const [inCollection, setInCollection] = useState(initialInCollection);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<CollectionOption[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setInCollection(initialInCollection);
  }, [initialInCollection]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mine: "1" });
      if (subjectId) {
        params.set("containsType", subjectType);
        params.set("containsId", subjectId);
      }
      const res = await fetch(`/api/collections?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = (await res.json()) as {
        items: CollectionOption[];
        memberCollectionIds?: string[];
      };
      setItems(json.items);
      const members = new Set(json.memberCollectionIds ?? []);
      setMemberIds(members);
      if (members.size > 0) setInCollection(true);
    } catch {
      setError("Could not load your collections");
    } finally {
      setLoading(false);
    }
  }, [subjectType, subjectId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  function openModal() {
    if (!signedIn) {
      router.push(signInHref);
      return;
    }
    setOpen(true);
  }

  async function addTo(slug: string) {
    setBusySlug(slug);
    setError(null);
    try {
      const res = await fetch(`/api/collections/${slug}/stickers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType, subjectId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not add");
        return;
      }
      setInCollection(true);
      setOpen(false);
    } catch {
      setError("Could not add");
    } finally {
      setBusySlug(null);
    }
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subjectType, subjectId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not create");
        return;
      }
      setInCollection(true);
      setOpen(false);
      setNewName("");
      if (json.slug) router.push(`/collections/${json.slug}`);
    } catch {
      setError("Could not create");
    } finally {
      setCreating(false);
    }
  }

  const trigger =
    variant === "pill" ? (
      <BusyButton
        type="button"
        onClick={openModal}
        className={`inline-flex items-center gap-2 rounded-full border border-divider bg-surface px-5 py-2.5 text-sm font-semibold hover:border-accent-pink/40 ${
          inCollection ? "text-accent-pink" : ""
        } ${className}`}
        aria-pressed={inCollection}
        title={inCollection ? "In a collection" : "Add to collection"}
      >
        <PlayingCardsFan className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        {inCollection ? "Saved" : "Collection"}
      </BusyButton>
    ) : (
      <BusyButton
        type="button"
        onClick={openModal}
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-badge text-foreground shadow-lg transition hover:scale-105 ${
          inCollection ? "text-accent-pink" : ""
        } ${className}`}
        aria-pressed={inCollection}
        aria-label={inCollection ? "In a collection" : "Add to collection"}
        title={inCollection ? "In a collection" : "Add to collection"}
      >
        <PlayingCardsFan className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </BusyButton>
    );

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Add to collection"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-[2rem] border border-divider bg-background p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Add to collection</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 text-secondary hover:bg-surface hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>

              {error ? (
                <p className="mt-3 text-sm text-accent-orange" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
                {loading ? (
                  <p className="py-4 text-center text-sm text-secondary">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="py-4 text-center text-sm text-secondary">
                    No collections yet — create one below.
                  </p>
                ) : (
                  items.map((c) => {
                    const already = memberIds.has(c.id);
                    return (
                      <BusyButton
                        key={c.id}
                        type="button"
                        busy={busySlug === c.slug}
                        disabled={already}
                        onClick={() => void addTo(c.slug)}
                        className={`flex w-full items-center justify-between rounded-2xl border border-divider bg-surface px-4 py-3 text-left text-sm font-semibold hover:border-accent-pink/40 disabled:opacity-70 ${
                          already ? "text-accent-pink" : ""
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2 truncate">
                          {already ? (
                            <Check
                              className="h-4 w-4 shrink-0"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          ) : null}
                          <span className="truncate">{c.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-secondary">
                          {already
                            ? "Saved"
                            : `${c.itemCount ?? c.stickerCount}/60`}
                        </span>
                      </BusyButton>
                    );
                  })
                )}
              </div>

              <div className="mt-4 border-t border-divider pt-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-inactive">
                  New collection
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={120}
                    placeholder="Unique name"
                    className="min-w-0 flex-1 rounded-full border border-divider bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent-pink/50"
                  />
                  <BusyButton
                    type="button"
                    busy={creating}
                    disabled={!newName.trim()}
                    onClick={() => void createAndAdd()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    Create
                  </BusyButton>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {trigger}
      {dialog}
    </>
  );
}
