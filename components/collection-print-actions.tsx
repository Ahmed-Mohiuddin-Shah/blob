"use client";

import Link from "next/link";
import { MAX_SHEET_STICKERS, MIN_PACK_SHEETS } from "@/lib/prints";

type Props = {
  collectionSlug: string;
  stickerIds: string[];
  sheetIds: string[];
  packIds: string[];
  /** Sheet ids resolved from packs (for combine count). */
  packSheetIds: string[];
  signedIn: boolean;
  signInHref: string;
};

export function CollectionPrintActions({
  collectionSlug,
  stickerIds,
  sheetIds,
  packIds,
  packSheetIds,
  signedIn,
  signInHref,
}: Props) {
  const uniqueSheets = new Set([...sheetIds, ...packSheetIds]);
  const canSheet = stickerIds.length >= 1;
  const canPack = uniqueSheets.size >= MIN_PACK_SHEETS;
  const canCombine = sheetIds.length + packIds.length >= 1 && canPack;

  if (!canSheet && !canPack) return null;

  const sheetHref = signedIn
    ? `/prints/sheets/new?collection=${encodeURIComponent(collectionSlug)}`
    : signInHref;
  const packHref = signedIn
    ? `/prints/packs/new?sheets=${sheetIds.join(",")}`
    : signInHref;
  const combineHref = signedIn
    ? `/prints/packs/new?sheets=${sheetIds.join(",")}&packs=${packIds.join(",")}`
    : signInHref;

  return (
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
      {canPack ? (
        <Link
          href={packHref}
          className="rounded-full border border-divider bg-surface px-4 py-2 text-sm font-semibold hover:border-accent-pink/40"
        >
          Make sticker pack
        </Link>
      ) : null}
      {canCombine ? (
        <Link
          href={combineHref}
          className="rounded-full border border-divider bg-surface px-4 py-2 text-sm font-semibold hover:border-accent-pink/40"
        >
          Combine into pack
        </Link>
      ) : null}
    </div>
  );
}
