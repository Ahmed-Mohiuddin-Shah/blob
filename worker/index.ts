/**
 * Remote encode worker — outbound WSS to BLOB_URL, uploads to GLASS.
 * Run: npm run worker
 */

import { randomUUID } from "crypto";
import os from "os";
import WebSocket from "ws";
import { loadWorkerEnv, wsUrl } from "./env";
import { runWorkerJob } from "./run-job";
import type { JobPayload } from "../lib/jobs/payload-types";

const WORKER_VERSION = process.env.WORKER_VERSION || "0.1.0";
/** Renew job lease while encode runs — must stay well under WORKER_LEASE_SECONDS. */
const JOB_PROGRESS_MS = 30_000;

const env = loadWorkerEnv();
const instanceId = process.env.WORKER_INSTANCE_ID || randomUUID().slice(0, 32);

let activeSlots = 0;
let socket: WebSocket | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let reconnectDelay = 1000;

function send(obj: unknown): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

/** Keep lease alive until encode finishes; reclaim only if these stop (dead / stuck). */
function withJobProgress<T>(jobId: string, work: () => Promise<T>): Promise<T> {
  send({ type: "job.progress", jobId });
  const timer = setInterval(() => {
    send({ type: "job.progress", jobId });
  }, JOB_PROGRESS_MS);
  return work().finally(() => clearInterval(timer));
}

function memMb(): number {
  return Math.round((os.totalmem() - os.freemem()) / (1024 * 1024));
}

function connect(): void {
  const url = wsUrl(env.blobUrl, env.workerApiKey);
  console.log(`Connecting ${url.replace(/token=[^&]+/, "token=…")}`);
  const ws = new WebSocket(url);
  socket = ws;

  ws.on("open", () => {
    reconnectDelay = 1000;
    send({
      type: "register",
      instanceId,
      version: WORKER_VERSION,
      capabilities: env.capabilities,
      concurrency: env.concurrency,
    });
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      send({
        type: "heartbeat",
        cpuPct: Math.min(100, os.loadavg()[0] * 10),
        memMb: memMb(),
        concurrency: env.concurrency,
        activeSlots,
      });
      // Opportunistic claim when idle
      if (activeSlots < env.concurrency) {
        send({ type: "job.claim" });
      }
    }, 15_000);
  });

  ws.on("message", (data) => {
    void (async () => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(data)) as Record<string, unknown>;
      } catch {
        return;
      }

      if (msg.type === "hello" || msg.type === "registered") {
        console.log("Worker:", msg.type, msg.workerId ?? msg.keyName ?? "");
        send({ type: "job.claim" });
        return;
      }

      if (msg.type === "job.available") {
        if (activeSlots < env.concurrency) {
          send({ type: "job.claim", jobId: msg.jobId });
        }
        return;
      }

      if (msg.type === "job.none") {
        return;
      }

      if (msg.type === "job.payload") {
        const jobId = String(msg.jobId);
        const payload = msg.payload as JobPayload;
        if (activeSlots >= env.concurrency) {
          send({
            type: "job.fail",
            jobId,
            message: "no free slots",
          });
          return;
        }
        activeSlots += 1;
        try {
          const result = await withJobProgress(jobId, () =>
            runWorkerJob(payload, env.glassApiUrl, env.glassApiKey),
          );
          send({ type: "job.complete", jobId, result });
        } catch (err) {
          send({
            type: "job.fail",
            jobId,
            message: err instanceof Error ? err.message : "encode failed",
          });
        } finally {
          activeSlots -= 1;
          if (activeSlots < env.concurrency) {
            send({ type: "job.claim" });
          }
        }
        return;
      }

      if (msg.type === "health.ping") {
        send({ type: "health.pong", id: msg.id });
        return;
      }

      if (msg.type === "error") {
        console.error("Server error:", msg.message);
      }
    })();
  });

  ws.on("close", () => {
    console.warn("WSS closed; reconnecting…");
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    scheduleReconnect();
  });

  ws.on("error", (err) => {
    console.error("WSS error:", err.message);
  });
}

function scheduleReconnect(): void {
  const delay = reconnectDelay;
  reconnectDelay = Math.min(30_000, reconnectDelay * 2);
  setTimeout(connect, delay);
}

connect();

process.on("SIGINT", () => {
  socket?.close();
  process.exit(0);
});
