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

export const CLAIM_REASON = {
  missing: "missing",
  mislabeled: "mislabeled",
} as const;

export const CLAIM_REASONS = [
  CLAIM_REASON.missing,
  CLAIM_REASON.mislabeled,
] as const;
export type ClaimReason = (typeof CLAIM_REASON)[keyof typeof CLAIM_REASON];

export const CLAIM_STATUS = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
} as const;

export const CLAIM_STATUSES = [
  CLAIM_STATUS.pending,
  CLAIM_STATUS.approved,
  CLAIM_STATUS.rejected,
] as const;
export type ClaimStatus = (typeof CLAIM_STATUS)[keyof typeof CLAIM_STATUS];
