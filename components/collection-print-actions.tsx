"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

type ExistingPack = { slug: string; name: string };

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
  const [existingPack, setExistingPack] = useState<ExistingPack | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const uniqueSheets = new Set([...sheetIds, ...packSheetIds]);
  const canSheet = stickerIds.length >= 1;
  const combineEligible =
    sheetIds.length + packIds.length >= 1 &&
    uniqueSheets.size >= MIN_PACK_SHEETS;
  const canCombine = canManagePack && combineEligible;
  const ownerOnlyPackHint = combineEligible && !canManagePack;

  if (!canSheet && !canCombine && !linkedPackSlug && !ownerOnlyPackHint) {
    return null;
  }

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
    setExistingPack(null);
    try {
      const res = await fetch(`/api/collections/${collectionSlug}/pack`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
        name?: string;
      };
      if (res.status === 409 && json.slug) {
        setExistingPack({
          slug: json.slug,
          name: json.name ?? "Existing pack",
        });
        return;
      }
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
      {ownerOnlyPackHint ? (
        <p className="text-sm text-secondary">
          {linkedPackSlug
            ? "Only the collection owner can update the pack."
            : "Only the collection owner can create the pack."}
        </p>
      ) : null}
      {error ? <p className="text-sm text-accent-orange">{error}</p> : null}

      {mounted && existingPack
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pack-exists-title"
            >
              <div className="w-full max-w-md rounded-[1.5rem] border border-divider bg-surface p-6 shadow-2xl">
                <p
                  id="pack-exists-title"
                  className="text-xs font-bold uppercase tracking-[0.18em] text-accent-orange"
                >
                  Pack already exists
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {existingPack.name}
                </h2>
                <p className="mt-2 text-sm text-secondary">
                  A pack with this combination of sheets already exists. Open it,
                  or stay here and change your selection.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <BusyButton
                    type="button"
                    busy={false}
                    onClick={() =>
                      router.push(`/prints/packs/${existingPack.slug}`)
                    }
                    className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    View pack
                  </BusyButton>
                  <button
                    type="button"
                    onClick={() => setExistingPack(null)}
                    className="rounded-full border border-divider px-5 py-2.5 text-sm font-semibold text-secondary"
                  >
                    Stay here
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
