import { NextResponse } from "next/server";
import {
  getAppInstanceId,
  listAppInstances,
  type AppInstanceRow,
} from "@/lib/jobs/app-instance";
import { dbHasCapable } from "@/lib/jobs/presence";
import {
  isHeartbeatFresh,
  JOB_STATUS,
  JOB_TYPE,
  onlineSeconds,
} from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function meiliOk(): Promise<boolean | null> {
  const host = process.env.MEILI_HOST?.replace(/\/$/, "");
  if (!host) return null;
  try {
    const res = await fetch(`${host}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const meili = await meiliOk();
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
  let pending = 0;
  let leased = 0;
  let running = 0;
  let remoteCapable = false;

  if (dbOk) {
    [apps, workers, pending, leased, running, remoteCapable] =
      await Promise.all([
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
        prisma.job.count({ where: { status: JOB_STATUS.pending } }),
        prisma.job.count({ where: { status: JOB_STATUS.leased } }),
        prisma.job.count({ where: { status: JOB_STATUS.running } }),
        dbHasCapable(JOB_TYPE.compositionEncode),
      ]);
  }

  const body = {
    ok,
    db: dbOk,
    meili,
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
    jobs: { pending, leased, running },
  };

  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
