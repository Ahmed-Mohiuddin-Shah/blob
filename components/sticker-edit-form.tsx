"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyButton } from "./busy-button";
import { BlobberCombobox, type BlobberPick } from "./blobber-combobox";
import type { CategoryOption } from "./sticker-create-form";
import { TagPillsInput } from "./tag-pills-input";
import { MODERATION_STATUS } from "@/lib/moderation";
import { VISIBILITIES, VISIBILITY } from "@/lib/stickers";

export type StickerEditInitial = {
  id: string;
  title: string;
  description: string;
  visibility: string;
  categoryId: string;
  tags: string[];
  attributionMode: "self" | "none" | "other";
  blobber: BlobberPick | null;
  sourceUrl: string;
  moderationNote?: string | null;
  moderationStatus: string;
};

export function StickerEditForm({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  initial: StickerEditInitial;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attributionMode, setAttributionMode] = useState(initial.attributionMode);
  const [blobber, setBlobber] = useState<BlobberPick | null>(initial.blobber);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      title: String(fd.get("title") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim(),
      visibility: String(fd.get("visibility") ?? VISIBILITY.public),
      categoryId: String(fd.get("categoryId") ?? ""),
      tags: tags.join(", "),
      attributionMode,
      blobberId: blobber?.id ?? "",
      blobberDisplayName: blobber?.displayName ?? "",
      sourceUrl,
    };
    try {
      const res = await fetch(`/api/stickers/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      if (json.status === MODERATION_STATUS.pendingReview) {
        router.push("/profile/pending");
      } else {
        router.push("/profile/uploads");
      }
      router.refresh();
    } catch {
      setError("Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-5 text-sm">
      {initial.moderationNote ? (
        <div className="rounded-[1.5rem] border border-accent-orange/40 bg-surface px-4 py-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-orange">
            Edit requested
          </p>
          <p className="mt-1 text-secondary">{initial.moderationNote}</p>
        </div>
      ) : null}

      <label className="block">
        <span className="text-secondary">Title</span>
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={initial.title}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
        />
      </label>

      <label className="block">
        <span className="text-secondary">Description</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={initial.description}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
        />
      </label>

      <label className="block">
        <span className="text-secondary">Attribution</span>
        <select
          required
          value={attributionMode}
          onChange={(e) => {
            const mode = e.target.value as "self" | "none" | "other";
            setAttributionMode(mode);
            if (mode !== "other") {
              setBlobber(null);
              setSourceUrl("");
            }
          }}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
        >
          <option value="self">Me (my Blobber)</option>
          <option value="none">Unknown / no credit</option>
          <option value="other">Another Blobber</option>
        </select>
      </label>

      {attributionMode === "other" ? (
        <>
          <label className="block">
            <span className="text-secondary">Blobber</span>
            <BlobberCombobox value={blobber} onChange={setBlobber} />
          </label>
          <label className="block">
            <span className="text-secondary">Source link (optional)</span>
            <input
              type="url"
              maxLength={2048}
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://"
              className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
            />
          </label>
        </>
      ) : null}

      <label className="block">
        <span className="text-secondary">Visibility</span>
        <select
          name="visibility"
          defaultValue={initial.visibility}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
        >
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {v === VISIBILITY.public
                ? "Public (after approval)"
                : v[0]!.toUpperCase() + v.slice(1)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-secondary">Category</span>
        <select
          name="categoryId"
          required
          defaultValue={initial.categoryId}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
        >
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-secondary">Tags</span>
        <div className="mt-1">
          <TagPillsInput value={tags} onChange={setTags} />
        </div>
      </label>

      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}

      <BusyButton
        type="submit"
        busy={busy}
        className="rounded-full bg-accent-gradient px-8 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:scale-105"
      >
        {initial.moderationStatus === MODERATION_STATUS.needsEdit
          ? "Save & resubmit"
          : "Save changes"}
      </BusyButton>
    </form>
  );
}
