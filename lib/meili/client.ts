import { Meilisearch } from "meilisearch";

let client: Meilisearch | null = null;

export function isMeiliConfigured(): boolean {
  return Boolean(process.env.MEILI_HOST?.trim() && process.env.MEILI_MASTER_KEY?.trim());
}

/** Admin client (master key). Null when Meili is not configured. */
export function getMeili(): Meilisearch | null {
  if (!isMeiliConfigured()) return null;
  if (!client) {
    client = new Meilisearch({
      host: process.env.MEILI_HOST!.replace(/\/$/, ""),
      apiKey: process.env.MEILI_MASTER_KEY!,
      // Embedder settings validate against live Ollama/CLIP — default 5s is too short.
      timeout: 120_000,
    });
  }
  return client;
}

export function meiliSearchKey(): string {
  return (
    process.env.MEILI_SEARCH_KEY?.trim() ||
    process.env.MEILI_MASTER_KEY?.trim() ||
    ""
  );
}
