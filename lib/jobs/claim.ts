import { hubSend } from "@/lib/jobs/hub";
import { buildJobPayload } from "@/lib/jobs/payload";
import { reclaimExpiredLeases } from "@/lib/jobs/reclaim";
import {
  JOB_STATUS,
  JOB_TYPES,
  type JobType,
  leaseSeconds,
} from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";

function isJobType(v: string): v is JobType {
  return (JOB_TYPES as readonly string[]).includes(v);
}

/** Atomically lease a pending job for a worker; send job.payload over WSS. */
export async function claimJobForWorker(opts: {
  workerId: bigint;
  jobId?: bigint;
  capabilities: Set<string>;
}): Promise<{ jobId: bigint; jobType: JobType } | null> {
  await reclaimExpiredLeases();

  const leaseMs = leaseSeconds() * 1000;
  const leaseExpiresAt = new Date(Date.now() + leaseMs);

  const claimed = await prisma.$transaction(async (tx) => {
    const where = opts.jobId
      ? {
          id: opts.jobId,
          status: JOB_STATUS.pending,
          type: { in: [...opts.capabilities] },
        }
      : {
          status: JOB_STATUS.pending,
          type: { in: [...opts.capabilities] },
        };

    const job = await tx.job.findFirst({
      where,
      orderBy: { createdAt: "asc" },
    });
    if (!job || !isJobType(job.type)) return null;

    const updated = await tx.job.updateMany({
      where: { id: job.id, status: JOB_STATUS.pending },
      data: {
        status: JOB_STATUS.leased,
        workerId: opts.workerId,
        leaseExpiresAt,
        attempts: { increment: 1 },
      },
    });
    if (updated.count === 0) return null;
    return job;
  });

  if (!claimed || !isJobType(claimed.type)) return null;

  const payload = await buildJobPayload(claimed.type, claimed.subjectId);
  await prisma.job.update({
    where: { id: claimed.id },
    data: {
      status: JOB_STATUS.running,
      payload: payload as object,
      leaseExpiresAt: new Date(Date.now() + leaseMs),
    },
  });

  hubSend(opts.workerId, {
    type: "job.payload",
    jobId: claimed.id.toString(),
    jobType: claimed.type,
    payload,
  });

  return { jobId: claimed.id, jobType: claimed.type };
}
