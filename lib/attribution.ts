/** Shared parse/validate for upload + edit attribution fields. */

export type AttributionFields = {
  authorName: string | null;
  sourceUrl: string | null;
};

export function parseAttributionInput(input: {
  hasAttribution: string;
  authorName?: string;
  sourceUrl?: string;
}): AttributionFields | { error: string } {
  const flag = input.hasAttribution.trim().toLowerCase();
  if (flag !== "yes" && flag !== "no") {
    return { error: "Has attribution must be Yes or No" };
  }
  if (flag === "no") {
    return { authorName: null, sourceUrl: null };
  }

  const authorName = (input.authorName ?? "").trim().slice(0, 200);
  const sourceUrl = (input.sourceUrl ?? "").trim().slice(0, 2048);
  if (!authorName) {
    return { error: "Attribution label required" };
  }
  if (!isHttpUrl(sourceUrl)) {
    return { error: "Source link must be an http(s) URL" };
  }
  return { authorName, sourceUrl };
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const CLAIM_REASONS = ["missing", "mislabeled"] as const;
export type ClaimReason = (typeof CLAIM_REASONS)[number];

export const CLAIM_STATUSES = ["pending", "approved", "rejected"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
