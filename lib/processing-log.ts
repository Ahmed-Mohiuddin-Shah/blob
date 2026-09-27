import { prisma } from "@/lib/prisma";

export const PROCESSING_SUBJECT = {
  sticker: "sticker",
  stickerSheet: "sticker_sheet",
  stickerPack: "sticker_pack",
  meili: "meili",
  worker: "worker",
} as const;

export type ProcessingSubjectType =
  (typeof PROCESSING_SUBJECT)[keyof typeof PROCESSING_SUBJECT];

/** Append-only encode/process / Meili / worker failure log. */
export async function appendProcessingLog(opts: {
  subjectType: ProcessingSubjectType | string;
  subjectId: bigint;
  subjectTitle: string;
  message: string;
}): Promise<void> {
  await prisma.processingLog.create({
    data: {
      subjectType: opts.subjectType.slice(0, 40),
      subjectId: opts.subjectId,
      subjectTitle: opts.subjectTitle.slice(0, 220),
      message: opts.message.slice(0, 8000),
    },
  });
}

/** Fire-and-forget Meili API error into admin processing logs. */
export function logMeiliError(title: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  void appendProcessingLog({
    subjectType: PROCESSING_SUBJECT.meili,
    subjectId: BigInt(0),
    subjectTitle: title.slice(0, 220),
    message,
  }).catch((e) => console.error("appendProcessingLog meili", e));
}
