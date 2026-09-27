import { Prisma } from "@prisma/client";
import { hubHasCapable, hubNotifyJobAvailable } from "@/lib/jobs/hub";
import { enqueueLocal } from "@/lib/jobs/local";
import { reclaimExpiredLeases } from "@/lib/jobs/reclaim";
import {
  idempotencyKey,
  JOB_STATUS,
  JOB_SUBJECT,
  JOB_TYPE,
  type JobType,
} from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";

function subjectTypeFor(type: JobType) {
  if (type === JOB_TYPE.compositionEncode) return JOB_SUBJECT.sticker;
  if (type === JOB_TYPE.sheetEncode) return JOB_SUBJECT.stickerSheet;
  return JOB_SUBJECT.stickerPack;
}

/**
 * Insert/reset a PENDING job, notify workers, or single-flight local fallback.
 */
export function enqueueJob(type: JobType, subjectId: bigint): void {
  void enqueueJobAsync(type, subjectId).catch((err) => {
    console.error("enqueueJob failed:", type, subjectId.toString(), err);
  });
}

export async function enqueueJobAsync(
  type: JobType,
  subjectId: bigint,
): Promise<bigint | null> {
  await reclaimExpiredLeases();

  const key = idempotencyKey(type, subjectId);
  const existing = await prisma.job.findUnique({
    where: { idempotencyKey: key },
  });

  if (
    existing &&
    (existing.status === JOB_STATUS.pending ||
      existing.status === JOB_STATUS.leased ||
      existing.status === JOB_STATUS.running)
  ) {
    hubNotifyJobAvailable(type, existing.id);
    if (!hubHasCapable(type)) {
      scheduleLocal(existing.id, type, subjectId);
    }
    return existing.id;
  }

  const job = existing
    ? await prisma.job.update({
        where: { id: existing.id },
        data: {
          status: JOB_STATUS.pending,
          workerId: null,
          leaseExpiresAt: null,
          payload: Prisma.DbNull,
          result: Prisma.DbNull,
          lastError: null,
          attempts: 0,
        },
      })
    : await prisma.job.create({
        data: {
          type,
          subjectType: subjectTypeFor(type),
          subjectId,
          status: JOB_STATUS.pending,
          idempotencyKey: key,
        },
      });

  hubNotifyJobAvailable(type, job.id);

  if (!hubHasCapable(type)) {
    scheduleLocal(job.id, type, subjectId);
  }

  return job.id;
}

function scheduleLocal(jobId: bigint, type: JobType, subjectId: bigint): void {
  enqueueLocal(async () => {
    // Re-check: a worker may have claimed while we waited in the local queue.
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== JOB_STATUS.pending) return;
    if (hubHasCapable(type)) {
      hubNotifyJobAvailable(type, jobId);
      return;
    }

    const leased = await prisma.job.updateMany({
      where: { id: jobId, status: JOB_STATUS.pending },
      data: {
        status: JOB_STATUS.running,
        attempts: { increment: 1 },
        leaseExpiresAt: null,
        workerId: null,
      },
    });
    if (leased.count === 0) return;

    try {
      const { runLocalJob } = await import("@/lib/jobs/run-local");
      await runLocalJob(type, subjectId);
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JOB_STATUS.succeeded,
          lastError: null,
          result: { local: true },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Local encode failed";
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JOB_STATUS.failed,
          lastError: message.slice(0, 2000),
        },
      });
      // Domain fail already handled inside process* for most paths; ensure sticker fail if needed
      throw err;
    }
  });
}
