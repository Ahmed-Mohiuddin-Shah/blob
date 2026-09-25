"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExportPayload } from "blob-editor/core";
import { BlobEditorHost } from "./blob-editor-host";

export function StickerComposeForm({
  stickerId,
  initialDocument,
}: {
  stickerId: string;
  initialDocument: unknown;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onExport(payload: ExportPayload) {
    setError(null);
    try {
      let document = payload.document;
      if (payload.mask) {
        const maskForm = new FormData();
        maskForm.set("file", payload.mask, "mask.png");
        const maskRes = await fetch("/api/assets", {
          method: "POST",
          body: maskForm,
        });
        const maskJson = (await maskRes.json()) as {
          id?: string;
          error?: string;
        };
        if (!maskRes.ok) throw new Error(maskJson.error ?? "Mask upload failed");
        document = {
          ...document,
          objects: document.objects.map((o) => {
            if (o.type !== "media" || o.kind !== "image") return o;
            if (o.mask_asset_id && /^\d+$/.test(o.mask_asset_id)) return o;
            return { ...o, mask_asset_id: maskJson.id! };
          }),
        };
      }

      const form = new FormData();
      form.set("document", JSON.stringify(document));
      form.set("chat", payload.exports.chat, "chat.png");
      form.set("thumbnail", payload.exports.thumbnail, "thumbnail.png");
      form.set("full", payload.exports.full, "full.png");
      if (payload.mask) form.set("mask", payload.mask, "mask.png");

      const res = await fetch(`/api/stickers/${stickerId}/composition`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      router.push("/profile/uploads");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      <BlobEditorHost
        document={initialDocument}
        onExport={onExport}
        onCancel={() => router.back()}
      />
    </div>
  );
}
