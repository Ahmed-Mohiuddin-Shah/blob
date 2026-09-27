import { instantMeiliSearch } from "@meilisearch/instant-meilisearch";

/** Client-side InstantSearch searchClient when public Meili env is set. */
export function createInstantSearchClient() {
  const host = process.env.NEXT_PUBLIC_MEILI_HOST?.trim();
  const key = process.env.NEXT_PUBLIC_MEILI_SEARCH_KEY?.trim();
  if (!host || !key) return null;
  const { searchClient } = instantMeiliSearch(host.replace(/\/$/, ""), key);
  return searchClient;
}
