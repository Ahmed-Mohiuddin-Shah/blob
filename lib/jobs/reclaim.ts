import { JOB_STATUS } from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";

/** Reset expired leases so another worker (or local fallback) can pick them up. */
export async function reclaimExpiredLeases(): Promise<number> {
  const now = new Date();
  const result = await prisma.job.updateMany({
    where: {
      status: { in: [JOB_STATUS.leased, JOB_STATUS.running] },
      leaseExpiresAt: { lt: now },
    },
    data: {
      status: JOB_STATUS.pending,
      workerId: null,
      leaseExpiresAt: null,
      lastError: "lease expired",
    },
  });
  return result.count;
}
