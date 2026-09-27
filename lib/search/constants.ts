export const SEARCH_META_STATUS = {
  none: "none",
  enriching: "enriching",
  pendingSearchMeta: "pending_search_meta",
  approved: "approved",
  stale: "stale",
} as const;

export type SearchMetaStatus =
  (typeof SEARCH_META_STATUS)[keyof typeof SEARCH_META_STATUS];
