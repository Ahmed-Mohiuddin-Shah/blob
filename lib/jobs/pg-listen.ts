/**
 * Dedicated pg connection for LISTEN/NOTIFY across app replicas.
 * Channel blob_control carries job wakeups and cross-instance worker pings.
 */

import { randomBytes } from "crypto";
import pg from "pg";
import { hubGet, hubNotifyJobAvailable, hubPing } from "@/lib/jobs/hub";
import type { JobType } from "@/lib/jobs/types";

const CHANNEL = "blob_control";

type JobAvailableMsg = {
  kind: "job_available";
  jobType: string;
  jobId: string;
};

type WorkerPingMsg = {
  kind: "worker_ping";
  workerId: string;
  requestId: string;
};

type WorkerPongMsg = {
  kind: "worker_pong";
  requestId: string;
  alive: boolean;
};

type ControlMsg = JobAvailableMsg | WorkerPingMsg | WorkerPongMsg;

type ListenState = {
  client: pg.Client | null;
  connecting: Promise<void> | null;
  stopped: boolean;
  pingWaiters: Map<
    string,
    { resolve: (alive: boolean) => void; timer: NodeJS.Timeout }
  >;
};

function state(): ListenState {
  const g = globalThis as unknown as { __blobPgListen?: ListenState };
  if (!g.__blobPgListen) {
    g.__blobPgListen = {
      client: null,
      connecting: null,
      stopped: false,
      pingWaiters: new Map(),
    };
  }
  return g.__blobPgListen;
}

/** Strip Prisma `?schema=` for node-pg. */
export function pgConnectionString(url = process.env.DATABASE_URL): string {
  if (!url) throw new Error("DATABASE_URL required for LISTEN/NOTIFY");
  const u = new URL(url);
  u.searchParams.delete("schema");
  return u.toString();
}

async function notifyRaw(payload: ControlMsg): Promise<void> {
  const json = JSON.stringify(payload);
  // Postgres NOTIFY payload limit ~8000 bytes — ours are tiny.
  await prismaNotify(json);
}

/** Prefer dedicated client; fall back to a one-shot client. */
async function prismaNotify(payload: string): Promise<void> {
  const s = state();
  if (s.client) {
    await s.client.query(`SELECT pg_notify($1, $2)`, [CHANNEL, payload]);
    return;
  }
  const c = new pg.Client({ connectionString: pgConnectionString() });
  await c.connect();
  try {
    await c.query(`SELECT pg_notify($1, $2)`, [CHANNEL, payload]);
  } finally {
    await c.end().catch(() => {
      /* ignore */
    });
  }
}

export async function notifyJobAvailable(
  jobType: JobType,
  jobId: bigint,
): Promise<void> {
  await notifyRaw({
    kind: "job_available",
    jobType,
    jobId: jobId.toString(),
  });
}

function handleNotification(payload: string): void {
  let msg: ControlMsg;
  try {
    msg = JSON.parse(payload) as ControlMsg;
  } catch {
    return;
  }
  if (msg.kind === "job_available") {
    hubNotifyJobAvailable(msg.jobType as JobType, BigInt(msg.jobId));
    return;
  }
  if (msg.kind === "worker_ping") {
    // Only the app holding the WSS answers — others stay silent so a false
    // pong cannot beat the owning instance.
    if (!hubGet(BigInt(msg.workerId))) return;
    void (async () => {
      const alive = await hubPing(BigInt(msg.workerId), 4000);
      await notifyRaw({
        kind: "worker_pong",
        requestId: msg.requestId,
        alive,
      }).catch(() => {
        /* ignore */
      });
    })();
    return;
  }
  if (msg.kind === "worker_pong") {
    const s = state();
    const w = s.pingWaiters.get(msg.requestId);
    if (!w) return;
    clearTimeout(w.timer);
    s.pingWaiters.delete(msg.requestId);
    w.resolve(msg.alive);
  }
}

async function connectLoop(): Promise<void> {
  const s = state();
  while (!s.stopped) {
    const client = new pg.Client({ connectionString: pgConnectionString() });
    s.client = client;
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      client.on("notification", (n) => {
        if (n.channel !== CHANNEL || !n.payload) return;
        handleNotification(n.payload);
      });
      await new Promise<void>((resolve) => {
        client.on("error", (err) => {
          console.error("pg LISTEN error:", err);
          resolve();
        });
        client.on("end", () => resolve());
      });
    } catch (err) {
      console.error("pg LISTEN connect failed:", err);
    } finally {
      s.client = null;
      await client.end().catch(() => {
        /* ignore */
      });
    }
    if (s.stopped) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/** Start LISTEN loop (idempotent). */
export function startPgListen(): void {
  const s = state();
  s.stopped = false;
  if (s.connecting) return;
  s.connecting = connectLoop().finally(() => {
    s.connecting = null;
  });
}

export async function stopPgListen(): Promise<void> {
  const s = state();
  s.stopped = true;
  if (s.client) {
    await s.client.end().catch(() => {
      /* ignore */
    });
    s.client = null;
  }
}

/**
 * Ping a worker: try local hub first, else NOTIFY other apps and wait for pong.
 */
export async function pingWorkerCrossInstance(
  workerId: bigint,
  timeoutMs = 6000,
): Promise<boolean> {
  const local = await hubPing(workerId, Math.min(4000, timeoutMs));
  if (local) return true;

  const requestId = randomBytes(8).toString("hex");
  const s = state();
  const alivePromise = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      s.pingWaiters.delete(requestId);
      resolve(false);
    }, timeoutMs);
    s.pingWaiters.set(requestId, { resolve, timer });
  });

  await notifyRaw({
    kind: "worker_ping",
    workerId: workerId.toString(),
    requestId,
  });

  return alivePromise;
}
