"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { BusyButton } from "./busy-button";

type Props = {
  collectionSlug: string;
  stickerId: string;
  /** When false, hide remove (last sticker). */
  canRemove: boolean;
};

export function RemoveFromCollectionButton({
  collectionSlug,
  stickerId,
  canRemove,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canRemove) return null;

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/collections/${collectionSlug}/stickers/${stickerId}`,
        { method: "DELETE" },
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not remove");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute left-3 bottom-3 z-10">
      <BusyButton
        type="button"
        busy={busy}
        onClick={() => void remove()}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-badge text-foreground shadow-lg transition hover:scale-105"
        aria-label="Remove from collection"
        title="Remove from collection"
      >
        <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </BusyButton>
      {error ? (
        <p className="mt-1 max-w-[8rem] text-[10px] text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
