/** Shared claim constants + URL helper. Attribution parse lives in lib/blobbers.ts. */

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
