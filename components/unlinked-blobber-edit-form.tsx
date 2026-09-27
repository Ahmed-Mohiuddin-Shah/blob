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
  initial: BlobberCmsPayload;
};

export function UnlinkedBlobberEditForm({ blobberId, initial }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [description, setDescription] = useState(initial.description ?? "");
  const [bannerId, setBannerId] = useState(initial.bannerGlassObjectId);
  const [avatarId, setAvatarId] = useState(initial.avatarGlassObjectId);
  const [showStickers, setShowStickers] = useState(initial.showStickers);
  const [showCollections, setShowCollections] = useState(initial.showCollections);
  const [showStickerSheets, setShowSheets] = useState(initial.showStickerSheets);
  const [socialLinks, setSocialLinks] = useState(initial.socialLinks);

  async function clearField(kind: "banner" | "avatar") {
    const form = new FormData();
    if (kind === "banner") form.set("clearBanner", "1");
    else form.set("clearAvatar", "1");
    const res = await fetch(`/api/admin/blobbers/${blobberId}`, {
      method: "PATCH",
      body: form,
    });
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      throw new Error(j.error ?? "Clear failed");
    }
  }

  function updateSocial(i: number, patch: Partial<(typeof socialLinks)[0]>) {
    setSocialLinks((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    const payload: BlobberCmsPayload = {
      displayName,
      description: description.trim() || null,
      bannerGlassObjectId: bannerId,
      avatarGlassObjectId: avatarId,
      showStickers,
      showCollections,
      showStickerSheets,
      socialLinks,
    };
    try {
      const res = await fetch(`/api/admin/blobbers/${blobberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      setOk(true);
      router.refresh();
    } catch {
      setError("Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSave} className="mx-auto max-w-lg space-y-5 text-sm">
      <p className="text-xs text-secondary">
        Direct admin edit of the full public profile — no approval queue. Image
        uploads apply immediately; Save writes everything else. Logged in
        moderation history.{" "}
        <Link
          href={`/blobbers/${blobberId}`}
          className="font-semibold text-accent-pink hover:underline"
        >
          View public profile
        </Link>
      </p>

      <label className="block">
        <span className="text-secondary">Display name</span>
        <input
          required
          maxLength={200}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
        />
      </label>

      <label className="block">
        <span className="text-secondary">Description</span>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
        />
      </label>

      <BlobberImageField
        label="Banner"
        kind="banner"
        mode="live"
        blobberId={blobberId}
        objectId={bannerId}
        previewUrl={blobberMediaUrl(bannerId)}
        onUploaded={(id) => setBannerId(id)}
        onCleared={() => {
          setBannerId(null);
          void clearField("banner").catch((err: Error) =>
            setError(err.message),
          );
        }}
      />

      <BlobberImageField
        label="Profile picture"
        kind="avatar"
        mode="live"
        blobberId={blobberId}
        objectId={avatarId}
        previewUrl={blobberMediaUrl(avatarId)}
        onUploaded={(id) => setAvatarId(id)}
        onCleared={() => {
          setAvatarId(null);
          void clearField("avatar").catch((err: Error) =>
            setError(err.message),
          );
        }}
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
              placeholder="Handle"
              value={s.handle}
              onChange={(e) => updateSocial(i, { handle: e.target.value })}
              className="w-full rounded-2xl border border-divider bg-background px-3 py-2"
            />
            <input
              placeholder="https://"
              value={s.url}
              onChange={(e) => updateSocial(i, { url: e.target.value })}
              className="w-full rounded-2xl border border-divider bg-background px-3 py-2"
            />
            <button
              type="button"
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
      {ok ? <p className="text-sm text-secondary">Saved.</p> : null}

      <BusyButton
        type="submit"
        busy={busy}
        className="rounded-full bg-accent-gradient px-8 py-3 text-sm font-semibold text-white"
      >
        Save profile
      </BusyButton>
    </form>
  );
}
