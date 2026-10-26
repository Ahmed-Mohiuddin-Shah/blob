import { NextResponse } from "next/server";
import {
  getAppInstanceId,
  listAppInstances,
  type AppInstanceRow,
} from "@/lib/jobs/app-instance";
import {
  getCatalogReindexStats,
  getJobQueueStats,
  probeMeili,
} from "@/lib/jobs/ops-stats";
import { dbHasCapable } from "@/lib/jobs/presence";
import {
  isHeartbeatFresh,
  JOB_TYPE,
  onlineSeconds,
} from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const meili = await probeMeili();
  const ok = dbOk;
  const now = Date.now();
  const since = new Date(now - onlineSeconds() * 1000);

  let apps: AppInstanceRow[] = [];
  let workers: Array<{
    id: bigint;
    instanceId: string;
    connectedAppInstanceId: string | null;
    lastHeartbeatAt: Date | null;
  }> = [];
  let jobs = { pending: 0, leased: 0, running: 0, byType: [] as Array<{ type: string; status: string; count: number }> };
  let reindex: Awaited<ReturnType<typeof getCatalogReindexStats>> = null;
  let remoteCapable = false;

  if (dbOk) {
    const [appRows, workerRows, queue, reindexRow, capable] = await Promise.all([
      listAppInstances(),
      prisma.worker.findMany({
        where: { lastHeartbeatAt: { gte: since } },
        select: {
          id: true,
          instanceId: true,
          connectedAppInstanceId: true,
          lastHeartbeatAt: true,
        },
        take: 50,
      }),
      getJobQueueStats(),
      getCatalogReindexStats(),
      dbHasCapable(JOB_TYPE.compositionEncode),
    ]);
    apps = appRows;
    workers = workerRows;
    jobs = queue;
    reindex = reindexRow;
    remoteCapable = capable;
  }

  const body = {
    ok,
    db: dbOk,
    meili,
    reindex,
    appInstanceId: getAppInstanceId(),
    onlineWindowSeconds: onlineSeconds(),
    apps: apps.map((a) => ({
      id: a.id,
      hostname: a.hostname,
      version: a.version,
      online: a.online,
      isSelf: a.isSelf,
      lastHeartbeatAt: a.lastHeartbeatAt.toISOString(),
    })),
    workers: {
      online: workers.length,
      localEncodeFallback: !remoteCapable,
      list: workers.map((w) => ({
        id: w.id.toString(),
        instanceId: w.instanceId,
        connectedAppInstanceId: w.connectedAppInstanceId,
        online: isHeartbeatFresh(w.lastHeartbeatAt, now),
        lastHeartbeatAt: w.lastHeartbeatAt?.toISOString() ?? null,
      })),
    },
    jobs,
  };

  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
