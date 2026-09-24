"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyButton } from "./busy-button";

export type CategoryOption = { id: string; name: string; slug: string };

export function StickerUploadForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fitMode, setFitMode] = useState("pad");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch("/api/stickers", { method: "POST", body: data });
      const json = (await res.json()) as { error?: string; slug?: string };
      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }
      router.push("/profile/uploads");
      router.refresh();
    } catch {
      setError("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-5 text-sm">
      <label className="block">
        <span className="text-secondary">File</span>
        <input
          name="file"
          type="file"
          required
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent-gradient file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <span className="mt-1 block text-xs text-secondary">
          PNG, JPEG, WebP, GIF, or MP4 (max 20 MiB). Video ≤10s preferred.
        </span>
      </label>

      <label className="block">
        <span className="text-secondary">Title</span>
        <input
          name="title"
          required
          maxLength={200}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
        />
      </label>

      <label className="block">
        <span className="text-secondary">Description</span>
        <textarea
          name="description"
          rows={3}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
        />
      </label>

      <fieldset>
        <legend className="text-secondary">Fit mode</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["crop", "fit", "pad"] as const).map((mode) => (
            <label
              key={mode}
              className={`cursor-pointer rounded-full border px-3 py-1.5 capitalize transition ${
                fitMode === mode
                  ? "border-transparent bg-accent-gradient text-white"
                  : "border-divider bg-surface text-secondary hover:border-accent-pink/40"
              }`}
            >
              <input
                type="radio"
                name="fitMode"
                value={mode}
                checked={fitMode === mode}
                onChange={() => setFitMode(mode)}
                className="sr-only"
              />
              {mode}
            </label>
          ))}
        </div>
      </fieldset>

      {fitMode === "pad" ? (
        <label className="block">
          <span className="text-secondary">Pad background</span>
          <div className="mt-1 flex items-center gap-3">
            <select
              name="padBackground"
              defaultValue="transparent"
              className="rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
            >
              <option value="transparent">Transparent</option>
              <option value="#ffffff">White</option>
              <option value="#000000">Black</option>
              <option value="#f10ea0">Pink</option>
            </select>
          </div>
        </label>
      ) : (
        <input type="hidden" name="padBackground" value="transparent" />
      )}

      <label className="block">
        <span className="text-secondary">Visibility</span>
        <select
          name="visibility"
          defaultValue="public"
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
          placeholder="cat, angry, meme"
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
        />
        <span className="mt-1 block text-xs text-secondary">Comma-separated</span>
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
        Upload sticker
      </BusyButton>
    </form>
  );
}
