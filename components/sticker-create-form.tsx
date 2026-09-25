"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExportPayload } from "blob-editor/core";
import { VISIBILITIES, VISIBILITY } from "@/lib/stickers";
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

type Step = "pick" | "edit" | "meta";

const emptyMeta: Meta = {
  title: "",
  description: "",
  hasAttribution: "",
  authorName: "",
  sourceUrl: "",
  categoryId: "",
  tags: "",
  visibility: VISIBILITY.public,
};

export function StickerCreateForm({
  categories,
  initialDocument,
  initialSourceAsset,
  remixedFromStickerId,
  parentCompositionId,
  defaultTitle,
}: {
  categories: CategoryOption[];
  initialDocument?: unknown;
  /** URL or deferred — remix/compose preload via /api/assets/:id */
  initialSourceAsset?: string;
  remixedFromStickerId?: string;
  parentCompositionId?: string;
  defaultTitle?: string;
}) {
  const router = useRouter();
  const isRemix = !!initialDocument;
  const [step, setStep] = useState<Step>(isRemix ? "edit" : "pick");
  const [meta, setMeta] = useState<Meta>({
    ...emptyMeta,
    title: defaultTitle ?? "",
  });
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [pendingExport, setPendingExport] = useState<ExportPayload | null>(
    null,
  );
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

  /** Editor Export → hold payload, go to metadata (create) or submit if remix already has title. */
  function onExport(payload: ExportPayload) {
    setPendingExport(payload);
    setError(null);
    setStep("meta");
  }

  async function submit() {
    const err = validateMeta();
    if (err) {
      setError(err);
      return;
    }
    if (!pendingExport) {
      setError("Finish editing first");
      setStep("edit");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let document = pendingExport.document;

      // Create: upload original File held client-side, rewrite ephemeral asset_ids.
      if (sourceFile) {
        const assetForm = new FormData();
        assetForm.set("file", sourceFile);
        const assetRes = await fetch("/api/assets", {
          method: "POST",
          body: assetForm,
        });
        const assetJson = (await assetRes.json()) as {
          id?: string;
          error?: string;
        };
        if (!assetRes.ok) {
          throw new Error(assetJson.error ?? "Original upload failed");
        }
        const assetId = assetJson.id!;
        document = {
          ...document,
          objects: document.objects.map((o) => {
            if (o.type !== "media") return o;
            if (!/^\d+$/.test(o.asset_id)) {
              return { ...o, asset_id: assetId };
            }
            return o;
          }),
        };
      }

      if (pendingExport.mask) {
        const maskForm = new FormData();
        maskForm.set("file", pendingExport.mask, "mask.png");
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
      form.set("chat", pendingExport.exports.chat, "chat.png");
      form.set("thumbnail", pendingExport.exports.thumbnail, "thumbnail.png");
      form.set("full", pendingExport.exports.full, "full.png");
      if (pendingExport.mask) {
        form.set("mask", pendingExport.mask, "mask.png");
      }

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

  if (step === "pick") {
    return (
      <div className="mx-auto max-w-md space-y-4 text-sm">
        {error ? (
          <p className="text-accent-orange" role="alert">
            {error}
          </p>
        ) : null}
        <label className="block">
          <span className="text-secondary">Media file</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent-gradient file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setSourceFile(file);
              setError(null);
              setStep("edit");
            }}
          />
          <span className="mt-1 block text-xs text-secondary">
            PNG, JPEG, WebP, GIF, or MP4 (max 20 MiB). Stays on your device until
            you submit.
          </span>
        </label>
      </div>
    );
  }

  if (step === "edit") {
    const sourceAsset = sourceFile ?? initialSourceAsset ?? undefined;
    // Draft document after a round-trip to metadata; else remix initial / create blank.
    const editorDocument = pendingExport?.document ?? initialDocument;
    return (
      <div className="space-y-4">
        {error ? (
          <p className="text-sm text-accent-orange" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-secondary">
            {meta.title.trim() ? (
              <>
                Editing{" "}
                <span className="font-semibold text-foreground">
                  {meta.title}
                </span>
              </>
            ) : (
              "Compose your sticker"
            )}
          </p>
          {pendingExport ? (
            <button
              type="button"
              className="text-xs font-semibold text-accent-pink"
              onClick={() => setStep("meta")}
            >
              Continue to metadata
            </button>
          ) : null}
        </div>
        <BlobEditorHost
          document={editorDocument}
          sourceAsset={sourceAsset}
          onExport={onExport}
          onCancel={() => {
            if (isRemix) {
              router.back();
              return;
            }
            setSourceFile(null);
            setPendingExport(null);
            setStep("pick");
          }}
        />
      </div>
    );
  }

  // step === "meta"
  return (
    <div className="mx-auto max-w-lg space-y-5 text-sm">
      {error ? (
        <p className="text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
          Metadata
        </p>
        <button
          type="button"
          className="text-xs font-semibold text-accent-pink"
          onClick={() => setStep("edit")}
        >
          Back to editor
        </button>
      </div>
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
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {v[0]!.toUpperCase() + v.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <BusyButton
        type="button"
        busy={busy}
        onClick={() => void submit()}
        className="w-full rounded-full bg-accent-gradient px-6 py-3 text-sm font-semibold text-white"
      >
        Submit for review
      </BusyButton>
    </div>
  );
}
