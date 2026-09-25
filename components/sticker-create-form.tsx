"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExportPayload } from "blob-editor/core";
import { BlobEditorHost } from "./blob-editor-host";
import { BusyButton } from "./busy-button";

export type CategoryOption = { id: string; name: string; slug: string };

type Meta = {
  title: string;
  description: string;
  hasAttribution: string;
  authorName: string;
  sourceUrl: string;
  categoryId: string;
  tags: string;
  visibility: string;
};

const emptyMeta: Meta = {
  title: "",
  description: "",
  hasAttribution: "",
  authorName: "",
  sourceUrl: "",
  categoryId: "",
  tags: "",
  visibility: "public",
};

export function StickerCreateForm({
  categories,
  initialDocument,
  remixedFromStickerId,
  parentCompositionId,
  defaultTitle,
}: {
  categories: CategoryOption[];
  initialDocument?: unknown;
  remixedFromStickerId?: string;
  parentCompositionId?: string;
  defaultTitle?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"meta" | "edit">(
    initialDocument ? "edit" : "meta",
  );
  const [meta, setMeta] = useState<Meta>({
    ...emptyMeta,
    title: defaultTitle ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validateMeta(): string | null {
    if (!meta.title.trim()) return "Title required";
    if (!meta.hasAttribution) return "Select attribution";
    if (meta.hasAttribution === "yes") {
      if (!meta.authorName.trim()) return "Attribution label required";
      if (!meta.sourceUrl.trim()) return "Source URL required";
    }
    return null;
  }

  async function onExport(payload: ExportPayload) {
    const err = validateMeta();
    if (err) {
      setError(err);
      setStep("meta");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Upload any new mask blob as an asset and rewrite document asset ids if needed.
      // Mask from export is a baked PNG; store as asset and leave document mask_asset_id as-is
      // when the editor already assigned one. If only mask Blob is present without id, upload it.
      let document = payload.document;
      if (payload.mask) {
        const maskForm = new FormData();
        maskForm.set("file", payload.mask, "mask.png");
        const maskRes = await fetch("/api/assets", {
          method: "POST",
          body: maskForm,
        });
        const maskJson = (await maskRes.json()) as { id?: string; error?: string };
        if (!maskRes.ok) throw new Error(maskJson.error ?? "Mask upload failed");
        // Attach mask asset id onto first image media if missing
        document = {
          ...document,
          objects: document.objects.map((o) => {
            if (o.type !== "media" || o.kind !== "image") return o;
            if (o.mask_asset_id && /^\d+$/.test(o.mask_asset_id)) return o;
            return { ...o, mask_asset_id: maskJson.id! };
          }),
        };
      }

      // Ensure primary media assets referenced in document exist (create flow: editor may
      // have used local blob URLs — host must upload source first via picker path).
      // When document already has numeric asset_ids from /api/assets, leave them.

      const form = new FormData();
      form.set("title", meta.title.trim());
      form.set("description", meta.description.trim());
      form.set("hasAttribution", meta.hasAttribution);
      form.set("authorName", meta.authorName.trim());
      form.set("sourceUrl", meta.sourceUrl.trim());
      form.set("categoryId", meta.categoryId);
      form.set("tags", meta.tags);
      form.set("visibility", meta.visibility);
      form.set("document", JSON.stringify(document));
      if (remixedFromStickerId) {
        form.set("remixedFromStickerId", remixedFromStickerId);
      }
      if (parentCompositionId) {
        form.set("parentCompositionId", parentCompositionId);
      }
      form.set("chat", payload.exports.chat, "chat.png");
      form.set("thumbnail", payload.exports.thumbnail, "thumbnail.png");
      form.set("full", payload.exports.full, "full.png");
      if (payload.mask) form.set("mask", payload.mask, "mask.png");

      const res = await fetch("/api/stickers", { method: "POST", body: form });
      const json = (await res.json()) as { error?: string; slug?: string };
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      router.push("/profile/uploads");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  if (step === "meta") {
    return (
      <div className="mx-auto max-w-lg space-y-5 text-sm">
        {error ? (
          <p className="text-accent-orange" role="alert">
            {error}
          </p>
        ) : null}
        <label className="block">
          <span className="text-secondary">Title</span>
          <input
            required
            maxLength={200}
            value={meta.title}
            onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
            className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
          />
        </label>
        <label className="block">
          <span className="text-secondary">Description</span>
          <textarea
            rows={3}
            value={meta.description}
            onChange={(e) =>
              setMeta((m) => ({ ...m, description: e.target.value }))
            }
            className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
          />
        </label>
        <label className="block">
          <span className="text-secondary">Has attribution?</span>
          <select
            required
            value={meta.hasAttribution}
            onChange={(e) =>
              setMeta((m) => ({ ...m, hasAttribution: e.target.value }))
            }
            className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
          >
            <option value="">Select…</option>
            <option value="yes">Yes — credit a source</option>
            <option value="no">No attribution</option>
          </select>
        </label>
        {meta.hasAttribution === "yes" ? (
          <>
            <label className="block">
              <span className="text-secondary">Attribution label</span>
              <input
                required
                maxLength={200}
                value={meta.authorName}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, authorName: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-secondary">Source URL</span>
              <input
                required
                type="url"
                value={meta.sourceUrl}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, sourceUrl: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
              />
            </label>
          </>
        ) : null}
        <label className="block">
          <span className="text-secondary">Category</span>
          <select
            value={meta.categoryId}
            onChange={(e) =>
              setMeta((m) => ({ ...m, categoryId: e.target.value }))
            }
            className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
          >
            <option value="">None</option>
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
            value={meta.tags}
            onChange={(e) => setMeta((m) => ({ ...m, tags: e.target.value }))}
            placeholder="angry, cat"
            className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
          />
        </label>
        <label className="block">
          <span className="text-secondary">Visibility</span>
          <select
            value={meta.visibility}
            onChange={(e) =>
              setMeta((m) => ({ ...m, visibility: e.target.value }))
            }
            className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </label>
        <BusyButton
          type="button"
          busy={busy}
          onClick={() => {
            const e = validateMeta();
            if (e) {
              setError(e);
              return;
            }
            setError(null);
            setStep("edit");
          }}
          className="w-full rounded-full bg-accent-gradient px-6 py-3 text-sm font-semibold text-white"
        >
          Open editor
        </BusyButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-secondary">
          Editing <span className="font-semibold text-foreground">{meta.title}</span>
        </p>
        <button
          type="button"
          className="text-xs font-semibold text-accent-pink"
          onClick={() => setStep("meta")}
        >
          Edit metadata
        </button>
      </div>
      <CreateEditor
        initialDocument={initialDocument}
        onExport={onExport}
        onCancel={() => setStep("meta")}
      />
    </div>
  );
}

function CreateEditor({
  initialDocument,
  onExport,
  onCancel,
}: {
  initialDocument?: unknown;
  onExport: (p: ExportPayload) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [assetId, setAssetId] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | File | undefined>();
  const [prepError, setPrepError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  // Remix / edit-with-document: skip file picker upload
  if (initialDocument) {
    return (
      <BlobEditorHost
        document={initialDocument}
        onExport={onExport}
        onCancel={onCancel}
      />
    );
  }

  if (!sourceUrl || !assetId) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-sm">
        {prepError ? (
          <p className="text-accent-orange" role="alert">
            {prepError}
          </p>
        ) : null}
        <label className="block">
          <span className="text-secondary">Media file</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
            disabled={preparing}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent-gradient file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setPreparing(true);
              setPrepError(null);
              try {
                const form = new FormData();
                form.set("file", file);
                const res = await fetch("/api/assets", {
                  method: "POST",
                  body: form,
                });
                const json = (await res.json()) as {
                  id?: string;
                  error?: string;
                };
                if (!res.ok) throw new Error(json.error ?? "Upload failed");
                setAssetId(json.id!);
                setSourceUrl(file);
              } catch (err) {
                setPrepError(
                  err instanceof Error ? err.message : "Upload failed",
                );
              } finally {
                setPreparing(false);
              }
            }}
          />
          <span className="mt-1 block text-xs text-secondary">
            PNG, JPEG, WebP, GIF, or MP4 (max 20 MiB). Uploaded as immutable
            original before editing.
          </span>
        </label>
        {preparing ? (
          <p className="text-xs text-secondary">Uploading original…</p>
        ) : null}
        <button
          type="button"
          className="text-xs font-semibold text-secondary"
          onClick={onCancel}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <AssetAwareEditor
      file={sourceUrl}
      assetId={assetId}
      onExport={onExport}
      onCancel={onCancel}
    />
  );
}

/** After asset upload, open editor with source file; rewrite asset_id on export. */
function AssetAwareEditor({
  file,
  assetId,
  onExport,
  onCancel,
}: {
  file: string | File | Blob;
  assetId: string;
  onExport: (p: ExportPayload) => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <BlobEditorHost
      sourceAsset={file}
      onCancel={onCancel}
      onExport={(payload) => {
        const document = {
          ...payload.document,
          objects: payload.document.objects.map((o) => {
            if (o.type !== "media") return o;
            // Replace ephemeral client ids with our uploaded asset id for primary media
            if (!/^\d+$/.test(o.asset_id)) {
              return { ...o, asset_id: assetId };
            }
            return o;
          }),
        };
        return onExport({ ...payload, document });
      }}
    />
  );
}
