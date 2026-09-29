"use client";

import { useActionState } from "react";
import {
  reindexCatalogAction,
  type ReindexActionState,
} from "@/app/actions/admin-search";
import { BusyButton } from "./busy-button";

const initial: ReindexActionState = {};

/** Superadmin: queue catalog → Meili reindex without running AI enrich. */
export function SearchReindexAdmin() {
  const [state, action, pending] = useActionState(reindexCatalogAction, initial);

  return (
    <div className="rounded-[28px] border border-divider bg-surface p-5">
      <h2 className="text-sm font-bold uppercase tracking-wider text-inactive">
        Search reindex
      </h2>
      <p className="mt-2 text-sm text-secondary">
        Queue an app-local job to push approved stickers, collections, prints,
        and blobbers into Meilisearch. Does not run AI caption enrich or remote
        workers.
      </p>
      <form action={action} className="mt-4">
        <BusyButton
          type="submit"
          busy={pending}
          className="rounded-full bg-accent-gradient px-5 py-2 text-sm font-semibold text-white"
        >
          Queue catalog reindex
        </BusyButton>
      </form>
      {state.error ? (
        <p className="mt-3 text-sm text-red-500" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && typeof state.queued === "number" ? (
        <p className="mt-3 text-sm text-secondary">
          Queued catalog reindex: {state.queued}
        </p>
      ) : null}
    </div>
  );
}
