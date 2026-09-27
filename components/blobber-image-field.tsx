"use client";

import { useRef, useState } from "react";
import { BusyButton } from "./busy-button";
import { blobberImageHint } from "@/lib/blobber-image-spec";
import { prepareBlobberImageClient } from "@/lib/prepare-blobber-image-client";

type Props = {
  label: string;
  kind: "banner" | "avatar";
  objectId: string | null;
  previewUrl: string | null;
  mode?: "staging" | "live";
  blobberId?: string;
  disabled?: boolean;
  onUploaded: (objectId: string) => void;
  onCleared: () => void;
};

export function BlobberImageField({
  label,
  kind,
  objectId,
  previewUrl,
  mode = "staging",
  blobberId,
  disabled,
  onUploaded,
  onCleared,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  async function onPick(file: File | null) {
    if (!file || disabled) return;
    setBusy(true);
    setError(null);
    let prepared: File;
    try {
      prepared = await prepareBlobberImageClient(file, kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process image");
      setBusy(false);
      return;
    }
    const local = URL.createObjectURL(prepared);
    setLocalPreview(local);
    try {
      const form = new FormData();
      form.set("file", prepared);
      form.set("kind", kind);
      form.set("mode", mode);
      if (blobberId) form.set("blobberId", blobberId);
      const res = await fetch("/api/blobbers/media", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { error?: string; objectId?: string };
      if (!res.ok || !json.objectId) {
        setError(json.error ?? "Upload failed");
        setLocalPreview(null);
        return;
      }
      onUploaded(json.objectId);
    } catch {
      setError("Upload failed");
      setLocalPreview(null);
    } finally {
      setBusy(false);
    }
  }

  const shown = localPreview || previewUrl;

  return (
    <div className="space-y-2">
      <span className="text-secondary">{label}</span>
      <p className="text-xs text-inactive">{blobberImageHint(kind)}</p>
      <div
        className={`relative overflow-hidden rounded-[1.5rem] border border-divider bg-surface ${
          kind === "banner" ? "h-28" : "h-24 w-24"
        }`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-inactive">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <BusyButton
          type="button"
          busy={busy}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-full bg-accent-gradient px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {objectId ? "Replace image" : "Upload image"}
        </BusyButton>
        {objectId || localPreview ? (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => {
              setLocalPreview(null);
              if (inputRef.current) inputRef.current.value = "";
              onCleared();
            }}
            className="rounded-full border border-divider px-4 py-2 text-xs font-semibold text-secondary disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
      />
      {error ? (
        <p className="text-xs text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
