import { prisma } from "@/lib/prisma";

export const PROCESSING_SUBJECT = {
  sticker: "sticker",
  stickerSheet: "sticker_sheet",
  stickerPack: "sticker_pack",
} as const;

export type ProcessingSubjectType =
  (typeof PROCESSING_SUBJECT)[keyof typeof PROCESSING_SUBJECT];

/** Append-only encode/process failure log. */
export async function appendProcessingLog(opts: {
  subjectType: ProcessingSubjectType;
  subjectId: bigint;
  subjectTitle: string;
  message: string;
}): Promise<void> {
  await prisma.processingLog.create({
    data: {
      subjectType: opts.subjectType,
      subjectId: opts.subjectId,
      subjectTitle: opts.subjectTitle.slice(0, 220),
      message: opts.message.slice(0, 8000),
    },
  });
}
