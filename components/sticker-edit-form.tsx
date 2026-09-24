"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyButton } from "./busy-button";
import type { CategoryOption } from "./sticker-upload-form";

export type StickerEditInitial = {
  id: string;
  title: string;
  description: string;
  visibility: string;
  categoryId: string;
  tags: string;
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      title: String(fd.get("title") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim(),
      visibility: String(fd.get("visibility") ?? "public"),
      categoryId: String(fd.get("categoryId") ?? ""),
      tags: String(fd.get("tags") ?? ""),
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
      if (json.status === "pending_review") {
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
        <span className="text-secondary">Visibility</span>
        <select
          name="visibility"
          defaultValue={initial.visibility}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
        >
          <option value="public">Public (after approval)</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
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
        {initial.moderationStatus === "needs_edit"
          ? "Save & resubmit"
          : "Save changes"}
      </BusyButton>
    </form>
  );
}
