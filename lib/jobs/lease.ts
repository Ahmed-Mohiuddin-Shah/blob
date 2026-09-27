import { JOB_STATUS, leaseSeconds } from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";

/** Extend lease while a remote worker reports progress. */
export async function touchLease(
  jobId: bigint,
  workerId: bigint,
): Promise<void> {
  await prisma.job.updateMany({
    where: {
      id: jobId,
      workerId,
      status: { in: [JOB_STATUS.leased, JOB_STATUS.running] },
    },
    data: {
      leaseExpiresAt: new Date(Date.now() + leaseSeconds() * 1000),
    },
  });
}
