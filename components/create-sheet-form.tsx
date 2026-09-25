"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { PrintExportPayload } from "blob-editor/print";
import { MAX_SHEET_STICKERS } from "@/lib/prints";
import { VISIBILITY } from "@/lib/stickers";
import { BusyButton } from "./busy-button";
import { PrintLayoutHost, type PrintAssetInput } from "./print-layout-host";
import {
  StickerPickerDialog,
  type PickerSticker,
} from "./sticker-picker-dialog";

type Props = {
  initialStickers?: PickerSticker[];
  /** Open picker immediately when empty */
  requirePickerFirst?: boolean;
};

export function CreateSheetForm({
  initialStickers = [],
  requirePickerFirst = true,
}: Props) {
  const router = useRouter();
  const [stickers, setStickers] = useState<PickerSticker[]>(
    initialStickers.slice(0, MAX_SHEET_STICKERS),
  );
  const [pickerOpen, setPickerOpen] = useState(
    requirePickerFirst && initialStickers.length === 0,
  );
  const [name, setName] = useState("");
  const [ackNonPublic, setAckNonPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasNonPublic = stickers.some(
    (s) => s.visibility !== VISIBILITY.public,
  );

  const assets: PrintAssetInput[] = useMemo(
    () =>
      stickers.map((s) => ({
        id: s.id,
        label: s.title,
        thumbUrl: s.thumbUrl,
        fullUrl: s.fullUrl,
        visibility: s.visibility,
      })),
    [stickers],
  );

  async function onExport(payload: PrintExportPayload) {
    setError(null);
    if (!name.trim()) {
      setError("Give your sheet a name");
      return;
    }
    if (hasNonPublic && !ackNonPublic) {
      setError(
        "Confirm that private/unlisted stickers will appear on this public sheet",
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          document: payload.document,
          stickerIds: stickers.map((s) => s.id),
          acknowledgeNonPublic: ackNonPublic || !hasNonPublic,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        slug?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not create sheet");
        return;
      }
      router.push(`/prints/sheets/${json.slug}`);
    } finally {
      setSaving(false);
    }
  }

  if (stickers.length === 0) {
    return (
      <div className="rounded-[2rem] border border-divider bg-surface p-8 text-center">
        <p className="text-sm text-secondary">
          Choose at least one sticker to start your sheet (max {MAX_SHEET_STICKERS}).
        </p>
        <BusyButton
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-6 rounded-full bg-accent-gradient px-6 py-3 text-sm font-semibold text-white"
        >
          Pick stickers
        </BusyButton>
        <StickerPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          selected={[]}
          onConfirm={(sel) => {
            setStickers(sel);
            setPickerOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-[1.5rem] border border-divider bg-surface p-5">
        <label className="min-w-[12rem] flex-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            Sheet name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            className="mt-1 w-full rounded-full border border-divider bg-background px-4 py-2.5 text-sm outline-none focus:border-accent-pink"
            placeholder="My sticker sheet"
          />
        </label>
        <BusyButton
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-full border border-divider px-4 py-2.5 text-sm font-semibold"
        >
          Add stickers ({stickers.length}/{MAX_SHEET_STICKERS})
        </BusyButton>
      </div>

      {hasNonPublic ? (
        <label className="flex items-start gap-3 rounded-[1.25rem] border border-accent-orange/40 bg-badge/40 p-4 text-sm">
          <input
            type="checkbox"
            checked={ackNonPublic}
            onChange={(e) => setAckNonPublic(e.target.checked)}
            className="mt-1"
          />
          <span>
            I understand this sheet is always public. Private or unlisted
            stickers in it will be visible on the printable download. See{" "}
            <a href="/terms" className="font-semibold text-accent-pink hover:underline">
              Terms
            </a>
            .
          </span>
        </label>
      ) : null}

      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      {saving ? (
        <p className="text-sm text-secondary">Creating sheet…</p>
      ) : null}

      <PrintLayoutHost
        assets={assets}
        onExport={onExport}
        onCancel={() => router.push("/prints")}
      />

      <StickerPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={stickers}
        onConfirm={(sel) => {
          setStickers(sel);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
