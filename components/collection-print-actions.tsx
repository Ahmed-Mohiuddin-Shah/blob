"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_SHEET_STICKERS, MIN_PACK_SHEETS } from "@/lib/prints";
import { BusyButton } from "./busy-button";

type Props = {
  collectionSlug: string;
  stickerIds: string[];
  sheetIds: string[];
  /** Pack ids excluding the collection-linked pack. */
  packIds: string[];
  /** Sheet ids from those packs (for combine count). */
  packSheetIds: string[];
  linkedPackSlug?: string | null;
  /** Owner-only: create/update the collection-linked pack. */
  canManagePack?: boolean;
  signedIn: boolean;
  signInHref: string;
};

export function CollectionPrintActions({
  collectionSlug,
  stickerIds,
  sheetIds,
  packIds,
  packSheetIds,
  linkedPackSlug,
  canManagePack = false,
  signedIn,
  signInHref,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uniqueSheets = new Set([...sheetIds, ...packSheetIds]);
  const canSheet = stickerIds.length >= 1;
  const canCombine =
    canManagePack &&
    sheetIds.length + packIds.length >= 1 &&
    uniqueSheets.size >= MIN_PACK_SHEETS;

  if (!canSheet && !canCombine && !linkedPackSlug) return null;

  const sheetHref = signedIn
    ? `/prints/sheets/new?collection=${encodeURIComponent(collectionSlug)}`
    : signInHref;

  async function combine() {
    if (!signedIn) {
      router.push(signInHref);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/collections/${collectionSlug}/pack`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not combine into pack");
        return;
      }
      if (json.slug) {
        router.push(`/prints/packs/${json.slug}`);
        router.refresh();
        return;
      }
      setError("Could not combine into pack");
    } catch {
      setError("Could not combine into pack");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canSheet ? (
          <Link
            href={sheetHref}
            className="rounded-full border border-divider bg-surface px-4 py-2 text-sm font-semibold hover:border-accent-pink/40"
            title={`Uses up to ${MAX_SHEET_STICKERS} stickers from this collection`}
          >
            Make sticker sheet
          </Link>
        ) : null}
        {canCombine ? (
          signedIn ? (
            <BusyButton
              type="button"
              busy={busy}
              onClick={() => void combine()}
              className="rounded-full border border-divider bg-surface px-4 py-2 text-sm font-semibold hover:border-accent-pink/40"
            >
              Combine into pack
            </BusyButton>
          ) : (
            <Link
              href={signInHref}
              className="rounded-full border border-divider bg-surface px-4 py-2 text-sm font-semibold hover:border-accent-pink/40"
            >
              Combine into pack
            </Link>
          )
        ) : null}
        {linkedPackSlug ? (
          <Link
            href={`/prints/packs/${linkedPackSlug}`}
            className="rounded-full border border-divider bg-surface px-4 py-2 text-sm font-semibold hover:border-accent-pink/40"
          >
            Go to Pack
          </Link>
        ) : null}
      </div>
      {error ? <p className="text-sm text-accent-orange">{error}</p> : null}
    </div>
  );
}
