import { Prisma } from "@prisma/client";
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

type ClaimedRow = {
  id: bigint;
  type: string;
  subject_id: bigint;
};

/** Atomically lease a pending job for a worker; send job.payload over WSS. */
export async function claimJobForWorker(opts: {
  workerId: bigint;
  jobId?: bigint;
  capabilities: Set<string>;
}): Promise<{ jobId: bigint; jobType: JobType } | null> {
  await reclaimExpiredLeases();

  const caps = [...opts.capabilities];
  if (caps.length === 0) return null;

  const leaseMs = leaseSeconds() * 1000;
  const leaseExpiresAt = new Date(Date.now() + leaseMs);

  // ponytail: SKIP LOCKED so contending workers take different rows (not CAS thrash).
  const claimed = await prisma.$transaction(async (tx) => {
    const idFilter =
      opts.jobId != null ? Prisma.sql`AND id = ${opts.jobId}` : Prisma.empty;
    const rows = await tx.$queryRaw<ClaimedRow[]>`
      WITH cte AS (
        SELECT id FROM jobs
        WHERE status = ${JOB_STATUS.pending}
          AND type IN (${Prisma.join(caps.map((c) => Prisma.sql`${c}`))})
          ${idFilter}
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE jobs
      SET
        status = ${JOB_STATUS.leased},
        worker_id = ${opts.workerId},
        lease_expires_at = ${leaseExpiresAt},
        attempts = attempts + 1,
        updated_at = NOW()
      FROM cte
      WHERE jobs.id = cte.id
      RETURNING jobs.id, jobs.type, jobs.subject_id
    `;
    return rows[0] ?? null;
  });

  if (!claimed || !isJobType(claimed.type)) return null;

  const payload = await buildJobPayload(claimed.type, claimed.subject_id);
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
