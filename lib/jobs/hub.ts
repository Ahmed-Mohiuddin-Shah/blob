/**
 * In-process WSS hub for worker connections on THIS app instance only.
 * Cross-instance wakeups use Postgres LISTEN/NOTIFY → hubNotifyJobAvailable.
 * Capability / local-encode decisions use DB heartbeats (lib/jobs/presence.ts).
 */

import type { JobType } from "@/lib/jobs/types";

export type WorkerSocket = {
  send: (data: string) => void;
  readyState: number;
};

type Conn = {
  workerId: bigint;
  apiKeyId: bigint;
  instanceId: string;
  capabilities: Set<string>;
  concurrency: number;
  activeSlots: number;
  socket: WorkerSocket;
};

const OPEN = 1;

type HubState = {
  byWorkerId: Map<string, Conn>;
  pingWaiters: Map<string, { resolve: (ok: boolean) => void; timer: NodeJS.Timeout }>;
};

function state(): HubState {
  const g = globalThis as unknown as { __blobWorkerHub?: HubState };
  if (!g.__blobWorkerHub) {
    g.__blobWorkerHub = {
      byWorkerId: new Map(),
      pingWaiters: new Map(),
    };
  }
  return g.__blobWorkerHub;
}

export function hubRegister(conn: Conn): void {
  const s = state();
  const key = conn.workerId.toString();
  const prev = s.byWorkerId.get(key);
  if (prev && prev.socket !== conn.socket) {
    try {
      prev.socket.send(JSON.stringify({ type: "session.replace" }));
    } catch {
      /* ignore */
    }
  }
  s.byWorkerId.set(key, conn);
}

export function hubUnregister(workerId: bigint, socket?: WorkerSocket): void {
  const s = state();
  const key = workerId.toString();
  const cur = s.byWorkerId.get(key);
  if (!cur) return;
  if (socket && cur.socket !== socket) return;
  s.byWorkerId.delete(key);
}

export function hubGet(workerId: bigint): Conn | undefined {
  return state().byWorkerId.get(workerId.toString());
}

export function hubHasCapable(jobType: JobType): boolean {
  for (const c of state().byWorkerId.values()) {
    if (c.socket.readyState !== OPEN) continue;
    if (!c.capabilities.has(jobType)) continue;
    if (c.activeSlots >= c.concurrency) continue;
    return true;
  }
  return false;
}

export function hubNotifyJobAvailable(jobType: JobType, jobId: bigint): void {
  const msg = JSON.stringify({
    type: "job.available",
    jobId: jobId.toString(),
    jobType,
  });
  for (const c of state().byWorkerId.values()) {
    if (c.socket.readyState !== OPEN) continue;
    if (!c.capabilities.has(jobType)) continue;
    if (c.activeSlots >= c.concurrency) continue;
    try {
      c.socket.send(msg);
    } catch {
      /* ignore */
    }
  }
}

export function hubSetSlots(workerId: bigint, activeSlots: number): void {
  const c = hubGet(workerId);
  if (c) c.activeSlots = activeSlots;
}

export function hubListOnline(): Array<{
  workerId: string;
  instanceId: string;
  capabilities: string[];
  concurrency: number;
  activeSlots: number;
}> {
  const out = [];
  for (const c of state().byWorkerId.values()) {
    if (c.socket.readyState !== OPEN) continue;
    out.push({
      workerId: c.workerId.toString(),
      instanceId: c.instanceId,
      capabilities: [...c.capabilities],
      concurrency: c.concurrency,
      activeSlots: c.activeSlots,
    });
  }
  return out;
}

/** Admin health ping — resolves true if worker replies within timeout. */
export function hubPing(
  workerId: bigint,
  timeoutMs = 5000,
): Promise<boolean> {
  const c = hubGet(workerId);
  if (!c || c.socket.readyState !== OPEN) return Promise.resolve(false);
  const s = state();
  const key = workerId.toString();
  const prev = s.pingWaiters.get(key);
  if (prev) {
    clearTimeout(prev.timer);
    prev.resolve(false);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      s.pingWaiters.delete(key);
      resolve(false);
    }, timeoutMs);
    s.pingWaiters.set(key, { resolve, timer });
    try {
      c.socket.send(JSON.stringify({ type: "health.ping", id: key }));
    } catch {
      clearTimeout(timer);
      s.pingWaiters.delete(key);
      resolve(false);
    }
  });
}

export function hubPong(workerId: bigint): void {
  const s = state();
  const key = workerId.toString();
  const w = s.pingWaiters.get(key);
  if (!w) return;
  clearTimeout(w.timer);
  s.pingWaiters.delete(key);
  w.resolve(true);
}

export function hubSend(workerId: bigint, payload: unknown): boolean {
  const c = hubGet(workerId);
  if (!c || c.socket.readyState !== OPEN) return false;
  try {
    c.socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
