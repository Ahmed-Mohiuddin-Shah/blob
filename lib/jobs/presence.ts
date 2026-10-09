/**
 * Cross-instance worker capability from DB heartbeats (not local WSS hub).
 */

import { isHeartbeatFresh, onlineSeconds, type JobType } from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";

/**
 * True if any worker has a fresh heartbeat and lists this job type.
 * Slot concurrency is enforced at claim time — presence is fleet-wide.
 */
export async function dbHasCapable(jobType: JobType): Promise<boolean> {
  const since = new Date(Date.now() - onlineSeconds() * 1000);
  const rows = await prisma.worker.findMany({
    where: { lastHeartbeatAt: { gte: since } },
    select: { capabilities: true },
    take: 50,
  });
  for (const row of rows) {
    try {
      const caps = JSON.parse(row.capabilities) as unknown;
      if (Array.isArray(caps) && caps.includes(jobType)) return true;
    } catch {
      /* ignore bad JSON */
    }
  }
  return false;
}

/** Export for tests — re-export freshness helper. */
export { isHeartbeatFresh };
