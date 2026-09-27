"use client";

import { useActionState } from "react";
import {
  reindexCatalogAction,
  type ReindexActionState,
} from "@/app/actions/admin-search";
import { BusyButton } from "./busy-button";

const initial: ReindexActionState = {};

/** Superadmin: catalog → Meili without running AI enrich. */
export function SearchReindexAdmin() {
  const [state, action, pending] = useActionState(reindexCatalogAction, initial);

  return (
    <div className="rounded-[28px] border border-divider bg-surface p-5">
      <h2 className="text-sm font-bold uppercase tracking-wider text-inactive">
        Search reindex
      </h2>
      <p className="mt-2 text-sm text-secondary">
        Push existing approved stickers, collections, prints, and blobbers into
        Meilisearch using titles, tags, and descriptions. Does not run AI
        caption enrich.
      </p>
      <form action={action} className="mt-4">
        <BusyButton
          type="submit"
          busy={pending}
          className="rounded-full bg-accent-gradient px-5 py-2 text-sm font-semibold text-white"
        >
          Reindex catalog
        </BusyButton>
      </form>
      {state.error ? (
        <p className="mt-3 text-sm text-red-500" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.result ? (
        <p className="mt-3 text-sm text-secondary">
          Indexed {state.result.stickers} stickers,{" "}
          {state.result.collections} collections, {state.result.sheets} sheets,{" "}
          {state.result.packs} packs, {state.result.blobbers} blobbers
          {state.result.errors
            ? ` · ${state.result.errors} errors`
            : ""}
          .
        </p>
      ) : null}
    </div>
  );
}
