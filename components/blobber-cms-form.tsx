"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  SOCIAL_LINK_TYPES,
  type BlobberCmsPayload,
  type SocialLinkType,
} from "@/lib/blobbers";
import { blobberMediaUrl } from "@/lib/blobber-media-url";
import { BlobberImageField } from "./blobber-image-field";
import { BusyButton } from "./busy-button";

type Props = {
  blobberId: string;
  live: BlobberCmsPayload;
  pendingStatus: string | null;
  adminNote: string | null;
  initialProposed: BlobberCmsPayload | null;
};

export function BlobberCmsForm({
  blobberId,
  live,
  pendingStatus,
  adminNote,
  initialProposed,
}: Props) {
  const router = useRouter();
  const seed = initialProposed ?? live;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(seed.displayName);
  const [description, setDescription] = useState(seed.description ?? "");
  const [bannerGlassObjectId, setBanner] = useState(
    seed.bannerGlassObjectId ?? "",
  );
  const [avatarGlassObjectId, setAvatar] = useState(
    seed.avatarGlassObjectId ?? "",
  );
  const [showStickers, setShowStickers] = useState(seed.showStickers);
  const [showCollections, setShowCollections] = useState(seed.showCollections);
  const [showStickerSheets, setShowSheets] = useState(seed.showStickerSheets);
  const [socialLinks, setSocialLinks] = useState(seed.socialLinks);

  const locked = pendingStatus === "pending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setBusy(true);
    setError(null);
    const payload: BlobberCmsPayload = {
      displayName,
      description: description.trim() || null,
      bannerGlassObjectId: bannerGlassObjectId.trim() || null,
      avatarGlassObjectId: avatarGlassObjectId.trim() || null,
      showStickers,
      showCollections,
      showStickerSheets,
      socialLinks,
    };
    try {
      const res = await fetch("/api/blobbers/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Submit failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Submit failed");
    } finally {
      setBusy(false);
    }
  }

  function updateSocial(i: number, patch: Partial<(typeof socialLinks)[0]>) {
    setSocialLinks((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-5 text-sm">
      <p className="text-xs text-secondary">
        Public profile:{" "}
        <Link
          href={`/blobbers/${blobberId}`}
          className="font-semibold text-accent-pink hover:underline"
        >
          /blobbers/{blobberId}
        </Link>
        . Changes need admin approval — the live page stays as-is until then.
      </p>

      {pendingStatus ? (
        <div className="rounded-[1.5rem] border border-accent-orange/40 bg-surface px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-orange">
            {pendingStatus === "pending"
              ? "Edit pending review"
              : pendingStatus === "needs_edit"
                ? "Edits requested"
                : pendingStatus}
          </p>
          {adminNote ? (
            <p className="mt-1 text-secondary">{adminNote}</p>
          ) : null}
        </div>
      ) : null}

      <label className="block">
        <span className="text-secondary">Display name</span>
        <input
          required
          maxLength={200}
          disabled={locked}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none disabled:opacity-60"
        />
      </label>

      <label className="block">
        <span className="text-secondary">Description</span>
        <textarea
          rows={4}
          disabled={locked}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none disabled:opacity-60"
        />
      </label>

      <BlobberImageField
        label="Banner"
        kind="banner"
        mode="staging"
        disabled={locked}
        objectId={bannerGlassObjectId || null}
        previewUrl={blobberMediaUrl(bannerGlassObjectId || null)}
        onUploaded={(id) => setBanner(id)}
        onCleared={() => setBanner("")}
      />

      <BlobberImageField
        label="Profile picture"
        kind="avatar"
        mode="staging"
        disabled={locked}
        objectId={avatarGlassObjectId || null}
        previewUrl={blobberMediaUrl(avatarGlassObjectId || null)}
        onUploaded={(id) => setAvatar(id)}
        onCleared={() => setAvatar("")}
      />

      <fieldset className="space-y-2">
        <legend className="text-secondary">Show sections</legend>
        {(
          [
            ["Stickers", showStickers, setShowStickers],
            ["Collections", showCollections, setShowCollections],
            ["Sticker sheets", showStickerSheets, setShowSheets],
          ] as const
        ).map(([label, checked, set]) => (
          <label key={label} className="flex items-center gap-2">
            <input
              type="checkbox"
              disabled={locked}
              checked={checked}
              onChange={(e) => set(e.target.checked)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-secondary">Social links</span>
          <button
            type="button"
            disabled={locked}
            onClick={() =>
              setSocialLinks((prev) => [
                ...prev,
                { linkType: "internet" as SocialLinkType, handle: "", url: "" },
              ])
            }
            className="text-xs font-semibold text-accent-pink"
          >
            + Add
          </button>
        </div>
        {socialLinks.map((s, i) => (
          <div
            key={i}
            className="space-y-2 rounded-[1.5rem] border border-divider bg-surface p-3"
          >
            <select
              disabled={locked}
              value={s.linkType}
              onChange={(e) =>
                updateSocial(i, {
                  linkType: e.target.value as SocialLinkType,
                })
              }
              className="w-full rounded-2xl border border-divider bg-background px-3 py-2"
            >
              {SOCIAL_LINK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              disabled={locked}
              placeholder="Handle"
              value={s.handle}
              onChange={(e) => updateSocial(i, { handle: e.target.value })}
              className="w-full rounded-2xl border border-divider bg-background px-3 py-2"
            />
            <input
              disabled={locked}
              placeholder="https://"
              value={s.url}
              onChange={(e) => updateSocial(i, { url: e.target.value })}
              className="w-full rounded-2xl border border-divider bg-background px-3 py-2"
            />
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                setSocialLinks((prev) => prev.filter((_, idx) => idx !== i))
              }
              className="text-xs text-accent-orange"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}

      <BusyButton
        type="submit"
        busy={busy}
        disabled={locked}
        className="rounded-full bg-accent-gradient px-8 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pendingStatus === "needs_edit" ? "Resubmit for review" : "Submit for review"}
      </BusyButton>
    </form>
  );
}
