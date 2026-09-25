import { prisma } from "@/lib/prisma";

export const MODERATION_SUBJECT = {
  sticker: "sticker",
  collection: "collection",
  attributionClaim: "attribution_claim",
} as const;

export type ModerationSubjectType =
  (typeof MODERATION_SUBJECT)[keyof typeof MODERATION_SUBJECT];

export const MODERATION_STATUS = {
  draft: "draft",
  pendingReview: "pending_review",
  needsEdit: "needs_edit",
  approved: "approved",
  rejected: "rejected",
  hidden: "hidden",
  deleted: "deleted",
} as const;

export type ModerationStatus =
  (typeof MODERATION_STATUS)[keyof typeof MODERATION_STATUS];

export const MODERATION_ACTION = {
  submitted: "submitted",
  approved: "approved",
  rejected: "rejected",
  editRequested: "edit_requested",
  resubmitted: "resubmitted",
  edited: "edited",
  hidden: "hidden",
  deleted: "deleted",
  claimSubmitted: "claim_submitted",
  claimApproved: "claim_approved",
  claimRejected: "claim_rejected",
} as const;

export type ModerationAction =
  (typeof MODERATION_ACTION)[keyof typeof MODERATION_ACTION];

export async function recordModerationEvent(input: {
  subjectType: ModerationSubjectType | string;
  subjectId: bigint;
  subjectTitle: string;
  action: ModerationAction | string;
  actorId: bigint;
  note?: string | null;
}) {
  return prisma.moderationEvent.create({
    data: {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      subjectTitle: input.subjectTitle.slice(0, 220),
      action: input.action,
      actorId: input.actorId,
      note: input.note?.trim() || null,
    },
  });
}
