"use client";

import { InstantSearch, useHits, useSearchBox } from "react-instantsearch";
import { useEffect } from "react";
import { createInstantSearchClient } from "@/lib/meili/instant";
import { MEILI_INDEX } from "@/lib/meili/indexes";

type Props = {
  query: string;
  onPick: (title: string) => void;
};

function TypeaheadHits({ onPick }: { onPick: (title: string) => void }) {
  const { items } = useHits<{ title?: string; name?: string }>();
  if (!items.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {items.slice(0, 8).map((hit) => {
        const label = hit.title || hit.name || "";
        if (!label) return null;
        return (
          <li key={hit.objectID}>
            <button
              type="button"
              className="rounded-full border border-divider bg-surface px-3 py-1.5 text-xs text-secondary hover:border-accent-pink/40 hover:text-accent-pink"
              onClick={() => onPick(label)}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SyncQuery({ query }: { query: string }) {
  const { refine } = useSearchBox();
  useEffect(() => {
    refine(query);
  }, [query, refine]);
  return null;
}

/** InstantSearch typeahead when NEXT_PUBLIC_MEILI_* is set; otherwise renders nothing. */
export function MeiliTypeahead({ query, onPick }: Props) {
  const client = createInstantSearchClient();
  if (!client || query.trim().length < 2) return null;

  return (
    <InstantSearch searchClient={client} indexName={MEILI_INDEX.stickers}>
      <SyncQuery query={query} />
      <TypeaheadHits onPick={onPick} />
    </InstantSearch>
  );
}
