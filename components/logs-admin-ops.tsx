"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  backfillWhatsAppOgAction,
  enrichMissingSearchMetaAction,
  reindexCatalogAction,
  type LogsOpState,
} from "@/app/actions/admin-logs-ops";
import { BusyButton } from "./busy-button";

type OpId = "reindex" | "og" | "enrich";

const OP_COPY: Record<
  OpId,
  { title: string; body: string; confirmLabel: string }
> = {
  reindex: {
    title: "Reindex catalog",
    body: "Queue an app-local job to push the full catalog into Meilisearch (titles, tags, descriptions — no AI). Heavy on Meili / the app process; prefer off-peak. Not run on remote encode workers.",
    confirmLabel: "Queue catalog reindex",
  },
  og: {
    title: "Re-encode missing WhatsApp OG",
    body: "Queue composition encode for stickers that have a full image but no WhatsApp OG JPEG (includes failed leftovers). This is a heavy operation and may hog CPU / workers / Glass. Prefer off-peak.",
    confirmLabel: "Queue OG re-encodes",
  },
  enrich: {
    title: "Generate search metadata",
    body: "Queue AI caption enrich for stickers with no or stale search meta. This is a heavy operation and may hog workers / vision API. Prefer off-peak.",
    confirmLabel: "Queue search enrich",
  },
};

const initial: LogsOpState = {};

/** Superadmin: catalog reindex + OG backfill + search enrich, each behind confirm. */
export function LogsAdminOps({
  missingOgCount,
  missingSearchMetaCount,
}: {
  missingOgCount: number;
  missingSearchMetaCount: number;
}) {
  const [reindexState, reindexAction, reindexPending] = useActionState(
    reindexCatalogAction,
    initial,
  );
  const [ogState, ogAction, ogPending] = useActionState(
    backfillWhatsAppOgAction,
    initial,
  );
  const [enrichState, enrichAction, enrichPending] = useActionState(
    enrichMissingSearchMetaAction,
    initial,
  );

  const [pendingOp, setPendingOp] = useState<OpId | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const busy = reindexPending || ogPending || enrichPending;

  function openConfirm(op: OpId) {
    setUnderstood(false);
    setPendingOp(op);
  }

  function closeConfirm() {
    if (busy) return;
    setPendingOp(null);
    setUnderstood(false);
  }

  const countHint =
    pendingOp === "og"
      ? `${missingOgCount} sticker${missingOgCount === 1 ? "" : "s"}`
      : pendingOp === "enrich"
        ? `${missingSearchMetaCount} sticker${missingSearchMetaCount === 1 ? "" : "s"}`
        : "full catalog";

  return (
    <div className="rounded-[28px] border border-divider bg-surface p-5">
      <h2 className="text-sm font-bold uppercase tracking-wider text-inactive">
        Heavy admin ops
      </h2>
      <p className="mt-2 text-sm text-secondary">
        Reindex Meili, backfill WhatsApp OG JPEGs, or queue AI search enrich.
        Each action asks for confirmation first.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <BusyButton
          type="button"
          busy={reindexPending}
          disabled={busy && !reindexPending}
          onClick={() => openConfirm("reindex")}
          className="rounded-full bg-accent-gradient px-5 py-2 text-sm font-semibold text-white"
        >
          Reindex catalog
        </BusyButton>
        <BusyButton
          type="button"
          busy={ogPending}
          disabled={busy && !ogPending}
          onClick={() => openConfirm("og")}
          className="rounded-full border border-divider bg-surface px-5 py-2 text-sm font-semibold hover:border-accent-pink/40"
        >
          Re-encode missing WhatsApp OG
          {missingOgCount > 0 ? ` (${missingOgCount})` : ""}
        </BusyButton>
        <BusyButton
          type="button"
          busy={enrichPending}
          disabled={busy && !enrichPending}
          onClick={() => openConfirm("enrich")}
          className="rounded-full border border-divider bg-surface px-5 py-2 text-sm font-semibold hover:border-accent-pink/40"
        >
          Generate search metadata
          {missingSearchMetaCount > 0 ? ` (${missingSearchMetaCount})` : ""}
        </BusyButton>
      </div>

      <OpResult state={reindexState} label="Queued catalog reindex" />
      <OpResult state={ogState} label="Queued OG re-encodes" />
      <OpResult state={enrichState} label="Queued search enrich jobs" />

      {mounted && pendingOp
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="logs-heavy-op-title"
            >
              <div className="w-full max-w-md rounded-[1.5rem] border border-divider bg-surface p-6 shadow-2xl">
                <p
                  id="logs-heavy-op-title"
                  className="text-xs font-bold uppercase tracking-[0.18em] text-accent-orange"
                >
                  {OP_COPY[pendingOp].title}
                </p>
                <p className="mt-3 text-sm text-secondary">
                  {OP_COPY[pendingOp].body}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  Scope: {countHint}
                </p>
                <label className="mt-4 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={understood}
                    onChange={(e) => setUnderstood(e.target.checked)}
                  />
                  <span>I understand this may hog resources</span>
                </label>
                <div className="mt-6 flex flex-wrap gap-2">
                  <form
                    action={
                      pendingOp === "reindex"
                        ? reindexAction
                        : pendingOp === "og"
                          ? ogAction
                          : enrichAction
                    }
                    onSubmit={() => {
                      setPendingOp(null);
                      setUnderstood(false);
                    }}
                  >
                    <BusyButton
                      type="submit"
                      busy={busy}
                      disabled={!understood || busy}
                      className="rounded-full bg-accent-gradient px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {OP_COPY[pendingOp].confirmLabel}
                    </BusyButton>
                  </form>
                  <button
                    type="button"
                    onClick={closeConfirm}
                    disabled={busy}
                    className="rounded-full border border-divider bg-surface px-5 py-2 text-sm font-semibold hover:border-accent-pink/40 disabled:opacity-50"
                  >
                    Cancel
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

function OpResult({
  state,
  label,
}: {
  state: LogsOpState;
  label?: string;
}) {
  if (state.error) {
    return (
      <p className="mt-3 text-sm text-red-500" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.result) {
    return (
      <p className="mt-3 text-sm text-secondary">
        Indexed {state.result.stickers} stickers,{" "}
        {state.result.collections} collections, {state.result.sheets} sheets,{" "}
        {state.result.packs} packs, {state.result.blobbers} blobbers
        {state.result.errors ? ` · ${state.result.errors} errors` : ""}.
      </p>
    );
  }
  if (state.ok && typeof state.queued === "number" && label) {
    return (
      <p className="mt-3 text-sm text-secondary">
        {label}: {state.queued}
      </p>
    );
  }
  return null;
}
