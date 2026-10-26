import { Prisma } from "@prisma/client";
import { getAppInstanceId } from "@/lib/jobs/app-instance";
import { hubNotifyJobAvailable } from "@/lib/jobs/hub";
import { enqueueLocal } from "@/lib/jobs/local";
import { notifyJobAvailable } from "@/lib/jobs/pg-listen";
import { dbHasCapable } from "@/lib/jobs/presence";
import { reclaimExpiredLeases } from "@/lib/jobs/reclaim";
import {
  idempotencyKey,
  JOB_STATUS,
  JOB_SUBJECT,
  JOB_TYPE,
  type JobType,
  leaseSeconds,
} from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";

const LEASE_REFRESH_MS = 30_000;

function subjectTypeFor(type: JobType) {
  if (
    type === JOB_TYPE.compositionEncode ||
    type === JOB_TYPE.searchEnrich
  ) {
    return JOB_SUBJECT.sticker;
  }
  if (type === JOB_TYPE.sheetEncode) return JOB_SUBJECT.stickerSheet;
  if (type === JOB_TYPE.catalogReindex) return JOB_SUBJECT.catalog;
  return JOB_SUBJECT.stickerPack;
}

/** catalog_reindex is Prisma+Meili — always app-local. Else local only if no fresh remote worker. */
export async function mustRunLocal(type: JobType): Promise<boolean> {
  if (type === JOB_TYPE.catalogReindex) return true;
  return !(await dbHasCapable(type));
}

async function wakeWorkers(type: JobType, jobId: bigint): Promise<void> {
  // catalog_reindex: NOTIFY only (no remote workers). Other types wake WSS hubs too.
  if (type !== JOB_TYPE.catalogReindex) {
    hubNotifyJobAvailable(type, jobId);
  }
  await notifyJobAvailable(type, jobId).catch((err) => {
    console.error("NOTIFY job_available failed:", err);
  });
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
    await wakeWorkers(type, existing.id);
    if (await mustRunLocal(type)) {
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
          ownerAppInstanceId: null,
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

  await wakeWorkers(type, job.id);

  if (await mustRunLocal(type)) {
    scheduleLocal(job.id, type, subjectId);
  }

  return job.id;
}

/**
 * LISTEN handler: wake local WSS hubs; if this job must run app-local, try ownership.
 */
export async function onRemoteJobAvailable(
  jobType: JobType,
  jobId: bigint,
): Promise<void> {
  if (jobType !== JOB_TYPE.catalogReindex) {
    hubNotifyJobAvailable(jobType, jobId);
  }
  if (!(await mustRunLocal(jobType))) return;
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== JOB_STATUS.pending) return;
  if (!Object.values(JOB_TYPE).includes(job.type as JobType)) return;
  scheduleLocal(job.id, job.type as JobType, job.subjectId);
}

function scheduleLocal(jobId: bigint, type: JobType, subjectId: bigint): void {
  enqueueLocal(async () => {
    await reclaimExpiredLeases();

    // Re-check: a worker may have claimed while we waited in the local queue.
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== JOB_STATUS.pending) return;
    if (type !== JOB_TYPE.catalogReindex && (await dbHasCapable(type))) {
      await wakeWorkers(type, jobId);
      return;
    }

    const ownerId = getAppInstanceId();
    const leaseMs = leaseSeconds() * 1000;
    const leaseExpiresAt = new Date(Date.now() + leaseMs);

    const leased = await prisma.job.updateMany({
      where: { id: jobId, status: JOB_STATUS.pending },
      data: {
        status: JOB_STATUS.running,
        attempts: { increment: 1 },
        ownerAppInstanceId: ownerId,
        leaseExpiresAt,
        workerId: null,
      },
    });
    if (leased.count === 0) return;

    const refreshLease = () => {
      void prisma.job
        .updateMany({
          where: {
            id: jobId,
            status: JOB_STATUS.running,
            ownerAppInstanceId: ownerId,
          },
          data: { leaseExpiresAt: new Date(Date.now() + leaseMs) },
        })
        .catch(() => {
          /* ignore */
        });
    };
    const leaseTimer = setInterval(refreshLease, LEASE_REFRESH_MS);

    try {
      const { runLocalJob } = await import("@/lib/jobs/run-local");
      await runLocalJob(type, subjectId);
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JOB_STATUS.succeeded,
          lastError: null,
          ownerAppInstanceId: null,
          leaseExpiresAt: null,
          result: { local: true, ownerAppInstanceId: ownerId },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Local encode failed";
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JOB_STATUS.failed,
          lastError: message.slice(0, 2000),
          ownerAppInstanceId: null,
          leaseExpiresAt: null,
        },
      });
      throw err;
    } finally {
      clearInterval(leaseTimer);
    }
  });
}
