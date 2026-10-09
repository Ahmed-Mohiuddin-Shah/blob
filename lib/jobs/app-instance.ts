/**
 * This control-plane process's presence row in app_instances.
 */

import { randomBytes } from "crypto";
import { hostname as osHostname } from "os";
import {
  APP_INSTANCE_STATUS,
  isHeartbeatFresh,
  onlineSeconds,
} from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";

const HEARTBEAT_MS = 15_000;

type BootState = {
  id: string;
  hostname: string;
  version: string;
  startedAt: Date;
  timer?: NodeJS.Timeout;
};

function boot(): BootState {
  const g = globalThis as unknown as { __blobAppInstance?: BootState };
  if (!g.__blobAppInstance) {
    const host = osHostname().slice(0, 120);
    const fromEnv = process.env.APP_INSTANCE_ID?.trim().slice(0, 64);
    const id =
      fromEnv ||
      `${host.slice(0, 48)}-${randomBytes(4).toString("hex")}`.slice(0, 64);
    g.__blobAppInstance = {
      id,
      hostname: host,
      version: (
        process.env.APP_VERSION ||
        process.env.npm_package_version ||
        "0.1.0"
      ).slice(0, 40),
      startedAt: new Date(),
    };
  }
  return g.__blobAppInstance;
}

export function getAppInstanceId(): string {
  return boot().id;
}

export async function upsertAppHeartbeat(): Promise<void> {
  const b = boot();
  const now = new Date();
  await prisma.appInstance.upsert({
    where: { id: b.id },
    create: {
      id: b.id,
      hostname: b.hostname,
      version: b.version,
      status: APP_INSTANCE_STATUS.online,
      startedAt: b.startedAt,
      lastHeartbeatAt: now,
    },
    update: {
      hostname: b.hostname,
      version: b.version,
      status: APP_INSTANCE_STATUS.online,
      lastHeartbeatAt: now,
    },
  });
}

export async function markAppInstanceOffline(): Promise<void> {
  const b = boot();
  await prisma.appInstance
    .update({
      where: { id: b.id },
      data: { status: APP_INSTANCE_STATUS.offline },
    })
    .catch(() => {
      /* ignore */
    });
}

/** Start periodic heartbeats. Call once from server.ts. */
export function startAppInstanceHeartbeat(): void {
  const b = boot();
  if (b.timer) return;
  void upsertAppHeartbeat().catch((err) =>
    console.error("app instance heartbeat failed:", err),
  );
  b.timer = setInterval(() => {
    void upsertAppHeartbeat().catch((err) =>
      console.error("app instance heartbeat failed:", err),
    );
  }, HEARTBEAT_MS);
  b.timer.unref?.();
}

export function stopAppInstanceHeartbeat(): void {
  const b = boot();
  if (b.timer) {
    clearInterval(b.timer);
    b.timer = undefined;
  }
}

export type AppInstanceRow = {
  id: string;
  hostname: string;
  version: string;
  status: string;
  startedAt: Date;
  lastHeartbeatAt: Date;
  online: boolean;
  isSelf: boolean;
};

export async function listAppInstances(): Promise<AppInstanceRow[]> {
  const selfId = getAppInstanceId();
  const now = Date.now();
  const rows = await prisma.appInstance.findMany({
    orderBy: { lastHeartbeatAt: "desc" },
    take: 50,
  });
  return rows.map((r) => {
    const online = isHeartbeatFresh(r.lastHeartbeatAt, now);
    return {
      id: r.id,
      hostname: r.hostname,
      version: r.version,
      status: online ? APP_INSTANCE_STATUS.online : APP_INSTANCE_STATUS.offline,
      startedAt: r.startedAt,
      lastHeartbeatAt: r.lastHeartbeatAt,
      online,
      isSelf: r.id === selfId,
    };
  });
}

export function appOnlineWindowSeconds(): number {
  return onlineSeconds();
}
