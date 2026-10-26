/**
 * Shared ops probes for GET /api/health and /profile/workers.
 */

import {
  idempotencyKey,
  JOB_STATUS,
  JOB_TYPE,
  CATALOG_REINDEX_SUBJECT_ID,
} from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";

export type MeiliProbe = {
  configured: boolean;
  host: string | null;
  ok: boolean | null;
  latencyMs: number | null;
};

export type ReindexJobStats = {
  status: string;
  ownerAppInstanceId: string | null;
  leaseExpiresAt: string | null;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
} | null;

export type JobQueueStats = {
  pending: number;
  leased: number;
  running: number;
  byType: Array<{ type: string; status: string; count: number }>;
};

export async function probeMeili(): Promise<MeiliProbe> {
  const host = process.env.MEILI_HOST?.replace(/\/$/, "") || null;
  if (!host) {
    return { configured: false, host: null, ok: null, latencyMs: null };
  }
  const started = Date.now();
  try {
    const res = await fetch(`${host}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return {
      configured: true,
      host,
      ok: res.ok,
      latencyMs: Date.now() - started,
    };
  } catch {
    return {
      configured: true,
      host,
      ok: false,
      latencyMs: Date.now() - started,
    };
  }
}

export async function getCatalogReindexStats(): Promise<ReindexJobStats> {
  const key = idempotencyKey(
    JOB_TYPE.catalogReindex,
    CATALOG_REINDEX_SUBJECT_ID,
  );
  const job = await prisma.job.findUnique({
    where: { idempotencyKey: key },
    select: {
      status: true,
      ownerAppInstanceId: true,
      leaseExpiresAt: true,
      attempts: true,
      lastError: true,
      updatedAt: true,
    },
  });
  if (!job) return null;
  return {
    status: job.status,
    ownerAppInstanceId: job.ownerAppInstanceId,
    leaseExpiresAt: job.leaseExpiresAt?.toISOString() ?? null,
    attempts: job.attempts,
    lastError: job.lastError,
    updatedAt: job.updatedAt.toISOString(),
  };
}

export async function getJobQueueStats(): Promise<JobQueueStats> {
  const [pending, leased, running, grouped] = await Promise.all([
    prisma.job.count({ where: { status: JOB_STATUS.pending } }),
    prisma.job.count({ where: { status: JOB_STATUS.leased } }),
    prisma.job.count({ where: { status: JOB_STATUS.running } }),
    prisma.job.groupBy({
      by: ["type", "status"],
      where: {
        status: {
          in: [JOB_STATUS.pending, JOB_STATUS.leased, JOB_STATUS.running],
        },
      },
      _count: { _all: true },
    }),
  ]);
  return {
    pending,
    leased,
    running,
    byType: grouped.map((g) => ({
      type: g.type,
      status: g.status,
      count: g._count._all,
    })),
  };
}
