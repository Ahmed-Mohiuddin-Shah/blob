"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyButton } from "./busy-button";

/** Retry reprocess for a failed sticker (owner or moderator). */
export function StickerFailedActions({
  stickerId,
  processingError,
}: {
  stickerId: string;
  processingError?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/stickers/${stickerId}/reprocess`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Retry failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-orange">
        Processing failed
      </p>
      {processingError ? (
        <p className="mt-2 text-sm text-accent-orange" role="alert">
          {processingError}
        </p>
      ) : null}
      <div className="mt-3">
        <BusyButton
          type="button"
          busy={busy}
          onClick={() => void retry()}
          className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
        >
          Retry
        </BusyButton>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
