"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { blobberMediaUrl } from "@/lib/blobber-media-url";
import { BlobberImageField } from "./blobber-image-field";
import { BusyButton } from "./busy-button";

type Props = {
  blobberId: string;
  displayName: string;
  bannerGlassObjectId: string | null;
  avatarGlassObjectId: string | null;
};

export function UnlinkedBlobberEditForm({
  blobberId,
  displayName: initialName,
  bannerGlassObjectId: initialBanner,
  avatarGlassObjectId: initialAvatar,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialName);
  const [bannerId, setBannerId] = useState(initialBanner);
  const [avatarId, setAvatarId] = useState(initialAvatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function clearField(kind: "banner" | "avatar") {
    const form = new FormData();
    form.set("displayName", displayName);
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

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch(`/api/admin/blobbers/${blobberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
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
        Direct admin edit — no approval queue. Image uploads apply immediately.
        Display name saves with the button. Logged in moderation history.{" "}
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
        Save display name
      </BusyButton>
    </form>
  );
}
