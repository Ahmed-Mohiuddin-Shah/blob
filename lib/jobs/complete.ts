import { createHash } from "crypto";
import { JOB_STATUS, JOB_TYPE } from "@/lib/jobs/types";
import { enqueueJob } from "@/lib/jobs/enqueue";
import {
  appendProcessingLog,
  PROCESSING_SUBJECT,
} from "@/lib/processing-log";
import { PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import {
  applySearchEnrichResult,
  type EnrichResult,
} from "@/lib/search/enrich";
import { SEARCH_META_STATUS } from "@/lib/search/constants";
import {
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
  PROCESSING_STATUS,
  mimeToExt,
} from "@/lib/stickers";

export type CompositionDerivativeResult = {
  kind: string;
  glassObjectId: string;
  glassPrismId: string;
  mimeType: string;
  fileExtension: string;
  width?: number | null;
  height?: number | null;
  sizeBytes: number;
  checksumSha256: string;
  durationMs?: number | null;
  hasAudio?: boolean;
};

export type CompositionJobResult = {
  skipped?: boolean;
  revisionId?: string;
  derivatives?: CompositionDerivativeResult[];
};

export type SheetJobResult = {
  pngGlassObjectId: string;
  pdfGlassObjectId: string;
  pngGlassPrismId: string;
  pdfGlassPrismId: string;
  pngSizeBytes: number;
  pdfSizeBytes: number;
};

export type PackJobResult = {
  deferred?: boolean;
  pngGlassObjectId?: string;
  pdfGlassObjectId?: string;
  pngGlassPrismId?: string;
  pdfGlassPrismId?: string;
  pngSizeBytes?: number;
  pdfSizeBytes?: number;
};

export async function completeJob(opts: {
  jobId: bigint;
  workerId: bigint;
  result: unknown;
}): Promise<void> {
  const job = await prisma.job.findFirst({
    where: {
      id: opts.jobId,
      workerId: opts.workerId,
      status: { in: [JOB_STATUS.leased, JOB_STATUS.running] },
    },
  });
  if (!job) throw new Error("Job not found or not leased by this worker");

  try {
    if (job.type === JOB_TYPE.compositionEncode) {
      await applyCompositionResult(job.subjectId, opts.result as CompositionJobResult);
    } else if (job.type === JOB_TYPE.sheetEncode) {
      await applySheetResult(job.subjectId, opts.result as SheetJobResult);
    } else if (job.type === JOB_TYPE.packEncode) {
      await applyPackResult(job.subjectId, opts.result as PackJobResult);
    } else if (job.type === JOB_TYPE.searchEnrich) {
      await applySearchEnrichResult(job.subjectId, opts.result as EnrichResult);
    }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JOB_STATUS.succeeded,
        result: opts.result as object,
        leaseExpiresAt: null,
        lastError: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Complete failed";
    await failJob({ jobId: job.id, workerId: opts.workerId, message });
    throw err;
  }
}

export async function failJob(opts: {
  jobId: bigint;
  workerId?: bigint | null;
  message: string;
}): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: opts.jobId } });
  if (!job) return;

  await prisma.job.update({
    where: { id: opts.jobId },
    data: {
      status: JOB_STATUS.failed,
      lastError: opts.message.slice(0, 2000),
      leaseExpiresAt: null,
    },
  });

  if (job.type === JOB_TYPE.compositionEncode) {
    await prisma.sticker.update({
      where: { id: job.subjectId },
      data: {
        processingStatus: PROCESSING_STATUS.failed,
        processingError: opts.message.slice(0, 2000),
      },
    });
    const s = await prisma.sticker.findUnique({
      where: { id: job.subjectId },
      select: { title: true },
    });
    await appendProcessingLog({
      subjectType: PROCESSING_SUBJECT.sticker,
      subjectId: job.subjectId,
      subjectTitle: s?.title ?? "sticker",
      message: opts.message,
    });
  } else if (job.type === JOB_TYPE.sheetEncode) {
    const sheet = await prisma.stickerSheet.update({
      where: { id: job.subjectId },
      data: {
        status: PRINT_STATUS.failed,
        errorMessage: opts.message.slice(0, 2000),
      },
      select: { name: true },
    });
    await appendProcessingLog({
      subjectType: PROCESSING_SUBJECT.stickerSheet,
      subjectId: job.subjectId,
      subjectTitle: sheet.name,
      message: opts.message,
    });
  } else if (job.type === JOB_TYPE.searchEnrich) {
    const s = await prisma.sticker.update({
      where: { id: job.subjectId },
      data: { searchMetaStatus: SEARCH_META_STATUS.none },
      select: { title: true },
    });
    await appendProcessingLog({
      subjectType: PROCESSING_SUBJECT.sticker,
      subjectId: job.subjectId,
      subjectTitle: s.title,
      message: `search_enrich: ${opts.message}`,
    });
  } else if (job.type === JOB_TYPE.packEncode) {
    const pack = await prisma.stickerPack.update({
      where: { id: job.subjectId },
      data: {
        status: PRINT_STATUS.failed,
        errorMessage: opts.message.slice(0, 2000),
      },
      select: { name: true },
    });
    await appendProcessingLog({
      subjectType: PROCESSING_SUBJECT.stickerPack,
      subjectId: job.subjectId,
      subjectTitle: pack.name,
      message: opts.message,
    });
  }
}

async function applyCompositionResult(
  stickerId: bigint,
  result: CompositionJobResult,
): Promise<void> {
  if (result.skipped) {
    await prisma.sticker.update({
      where: { id: stickerId },
      data: {
        processingStatus: PROCESSING_STATUS.ready,
        processingError: null,
      },
    });
    return;
  }
  if (!result.revisionId || !result.derivatives?.length) {
    throw new Error("Invalid composition result");
  }
  const revisionId = BigInt(result.revisionId);
  const sticker = await prisma.sticker.findUnique({
    where: { id: stickerId },
    select: { slug: true },
  });
  if (!sticker) throw new Error("Sticker missing");

  for (const item of result.derivatives) {
    if (item.kind === MEDIA_KIND.thumbnail) {
      const existing = await prisma.mediaAsset.findUnique({
        where: { stickerId_kind: { stickerId, kind: MEDIA_KIND.thumbnail } },
      });
      if (
        existing?.compositionRevisionId &&
        existing.compositionRevisionId !== revisionId
      ) {
        await prisma.mediaAsset.deleteMany({
          where: { stickerId, kind: MEDIA_KIND.prevThumbnail },
        });
        await prisma.mediaAsset.update({
          where: { id: existing.id },
          data: { kind: MEDIA_KIND.prevThumbnail },
        });
      }
    }

    const ext = item.fileExtension || mimeToExt(item.mimeType);
    await prisma.mediaAsset.upsert({
      where: { stickerId_kind: { stickerId, kind: item.kind } },
      create: {
        stickerId,
        compositionRevisionId: revisionId,
        kind: item.kind,
        mimeType: item.mimeType,
        fileExtension: ext,
        width: item.width ?? null,
        height: item.height ?? null,
        durationMs: item.durationMs ?? null,
        hasAudio: item.hasAudio ?? false,
        sizeBytes: BigInt(item.sizeBytes),
        checksumSha256: item.checksumSha256,
        glassObjectId: item.glassObjectId,
        glassPrismId: item.glassPrismId,
        status: MEDIA_ASSET_STATUS.ready,
      },
      update: {
        compositionRevisionId: revisionId,
        mimeType: item.mimeType,
        fileExtension: ext,
        width: item.width ?? null,
        height: item.height ?? null,
        durationMs: item.durationMs ?? null,
        hasAudio: item.hasAudio ?? false,
        sizeBytes: BigInt(item.sizeBytes),
        checksumSha256: item.checksumSha256,
        glassObjectId: item.glassObjectId,
        glassPrismId: item.glassPrismId,
        status: MEDIA_ASSET_STATUS.ready,
      },
    });
  }

  await prisma.sticker.update({
    where: { id: stickerId },
    data: {
      processingStatus: PROCESSING_STATUS.ready,
      processingError: null,
    },
  });
}

async function applySheetResult(
  sheetId: bigint,
  result: SheetJobResult,
): Promise<void> {
  await prisma.stickerSheet.update({
    where: { id: sheetId },
    data: {
      status: PRINT_STATUS.ready,
      errorMessage: null,
      pngGlassObjectId: result.pngGlassObjectId,
      pngGlassPrismId: result.pngGlassPrismId,
      pdfGlassObjectId: result.pdfGlassObjectId,
      pdfGlassPrismId: result.pdfGlassPrismId,
      pngSizeBytes: BigInt(result.pngSizeBytes),
      pdfSizeBytes: BigInt(result.pdfSizeBytes),
    },
  });

  const { syncPrintSearch } = await import("@/lib/search/sync");
  syncPrintSearch("sheet", sheetId);

  const waiting = await prisma.packSheet.findMany({
    where: { sheetId },
    select: { packId: true },
  });
  for (const { packId } of waiting) {
    enqueueJob(JOB_TYPE.packEncode, packId);
  }
}

async function applyPackResult(
  packId: bigint,
  result: PackJobResult,
): Promise<void> {
  if (result.deferred) {
    // Sheets not ready — leave pack pending; sheet completion will re-enqueue.
    return;
  }
  if (
    !result.pngGlassObjectId ||
    !result.pdfGlassObjectId ||
    !result.pngGlassPrismId ||
    !result.pdfGlassPrismId
  ) {
    throw new Error("Invalid pack result");
  }
  await prisma.stickerPack.update({
    where: { id: packId },
    data: {
      status: PRINT_STATUS.ready,
      errorMessage: null,
      pngGlassObjectId: result.pngGlassObjectId,
      pngGlassPrismId: result.pngGlassPrismId,
      pdfGlassObjectId: result.pdfGlassObjectId,
      pdfGlassPrismId: result.pdfGlassPrismId,
      pngSizeBytes: BigInt(result.pngSizeBytes ?? 0),
      pdfSizeBytes: BigInt(result.pdfSizeBytes ?? 0),
    },
  });

  const { syncPrintSearch } = await import("@/lib/search/sync");
  const { recomputeStickerPopularity } = await import("@/lib/search/popularity");
  syncPrintSearch("pack", packId);
  const packStickers = await prisma.sheetSticker.findMany({
    where: { sheet: { packs: { some: { packId } } } },
    select: { stickerId: true },
    distinct: ["stickerId"],
  });
  for (const { stickerId } of packStickers) {
    void recomputeStickerPopularity(stickerId);
  }
}

export function sha256Hex(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}
