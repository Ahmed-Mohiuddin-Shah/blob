"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyButton } from "./busy-button";
import type { CategoryOption } from "./sticker-create-form";
import { MODERATION_STATUS } from "@/lib/moderation";
import { VISIBILITIES, VISIBILITY } from "@/lib/stickers";

export type StickerEditInitial = {
  id: string;
  title: string;
  description: string;
  visibility: string;
  categoryId: string;
  tags: string;
  hasAttribution: "yes" | "no";
  authorName: string;
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
  const [hasAttribution, setHasAttribution] = useState(initial.hasAttribution);

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
      tags: String(fd.get("tags") ?? ""),
      hasAttribution: String(fd.get("hasAttribution") ?? ""),
      authorName: String(fd.get("authorName") ?? ""),
      sourceUrl: String(fd.get("sourceUrl") ?? ""),
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
        <span className="text-secondary">Has attribution?</span>
        <select
          name="hasAttribution"
          required
          value={hasAttribution}
          onChange={(e) => setHasAttribution(e.target.value as "yes" | "no")}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
        >
          <option value="yes">Yes — credit a source</option>
          <option value="no">No attribution</option>
        </select>
      </label>

      {hasAttribution === "yes" ? (
        <>
          <label className="block">
            <span className="text-secondary">Attribution label</span>
            <input
              name="authorName"
              required
              maxLength={200}
              defaultValue={initial.authorName}
              placeholder="Artist or source name"
              className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
            />
          </label>
          <label className="block">
            <span className="text-secondary">Source link</span>
            <input
              name="sourceUrl"
              type="url"
              required
              maxLength={2048}
              defaultValue={initial.sourceUrl}
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
        <input
          name="tags"
          defaultValue={initial.tags}
          placeholder="CAT, ANGRY, MEME"
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
        />
        <span className="mt-1 block text-xs text-secondary">
          Comma-separated · saved as ALL CAPS
        </span>
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
