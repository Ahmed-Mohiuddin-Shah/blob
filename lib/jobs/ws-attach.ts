import type { IncomingMessage, Server as HttpServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { getAppInstanceId } from "@/lib/jobs/app-instance";
import { hashWorkerKey } from "@/lib/jobs/auth";
import {
  hubPong,
  hubRegister,
  hubSetSlots,
  hubUnregister,
} from "@/lib/jobs/hub";
import { touchLease } from "@/lib/jobs/lease";
import { JOB_TYPE, JOB_TYPES, WORKER_STATUS } from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";

// ponytail: lazy-import claim/complete — they pull ESM-only glass-ts; tsx boots server as CJS.

const WS_PATH = "/api/workers/ws";

/** Jobs that only run in the Next process — never register on remote workers. */
const APP_LOCAL_JOB_TYPES = new Set<string>([JOB_TYPE.catalogReindex]);

function parseCapabilities(raw: unknown): Set<string> {
  const allowed = new Set<string>(JOB_TYPES);
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",").map((s) => s.trim())
      : [...JOB_TYPES];
  return new Set(
    list.filter(
      (c) =>
        typeof c === "string" &&
        allowed.has(c) &&
        !APP_LOCAL_JOB_TYPES.has(c),
    ),
  );
}

async function authFromUpgrade(
  req: IncomingMessage,
): Promise<{ apiKeyId: bigint; name: string } | null> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const q = url.searchParams.get("token");
  const auth = req.headers.authorization;
  const secret =
    q ??
    (auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null);
  if (!secret) return null;
  const row = await prisma.workerApiKey.findUnique({
    where: { keyHash: hashWorkerKey(secret) },
  });
  if (!row || row.revokedAt) return null;
  return { apiKeyId: row.id, name: row.name };
}

export function attachWorkerWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    // Leave other upgrades alone (e.g. Next HMR in dev).
    if (pathname !== WS_PATH) return;
    void authFromUpgrade(req).then((auth) => {
      if (!auth) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, auth);
      });
    });
  });

  wss.on(
    "connection",
    (
      ws: WebSocket,
      _req: IncomingMessage,
      auth: { apiKeyId: bigint; name: string },
    ) => {
      let workerId: bigint | null = null;
      let capabilities = new Set<string>(
        [...JOB_TYPES].filter((t) => !APP_LOCAL_JOB_TYPES.has(t)),
      );
      let concurrency = 1;

      const send = (obj: unknown) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(obj));
        }
      };

      send({ type: "hello", keyName: auth.name });

      ws.on("message", (data) => {
        void (async () => {
          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(String(data)) as Record<string, unknown>;
          } catch {
            return;
          }
          const type = msg.type;
          try {
            if (type === "register") {
              const instanceId = String(msg.instanceId ?? "").slice(0, 64);
              if (!instanceId) {
                send({ type: "error", message: "instanceId required" });
                return;
              }
              capabilities = parseCapabilities(msg.capabilities);
              concurrency = Math.max(
                1,
                Math.min(32, Number(msg.concurrency) || 1),
              );
              const version = String(msg.version ?? "0").slice(0, 40);
              const appId = getAppInstanceId();
              const row = await prisma.worker.upsert({
                where: {
                  apiKeyId_instanceId: {
                    apiKeyId: auth.apiKeyId,
                    instanceId,
                  },
                },
                create: {
                  apiKeyId: auth.apiKeyId,
                  instanceId,
                  version,
                  capabilities: JSON.stringify([...capabilities]),
                  concurrency,
                  status: WORKER_STATUS.online,
                  lastHeartbeatAt: new Date(),
                  connectedAppInstanceId: appId,
                },
                update: {
                  version,
                  capabilities: JSON.stringify([...capabilities]),
                  concurrency,
                  status: WORKER_STATUS.online,
                  lastHeartbeatAt: new Date(),
                  connectedAppInstanceId: appId,
                },
              });
              workerId = row.id;
              hubRegister({
                workerId: row.id,
                apiKeyId: auth.apiKeyId,
                instanceId,
                capabilities,
                concurrency,
                activeSlots: 0,
                socket: ws,
              });
              send({
                type: "registered",
                workerId: row.id.toString(),
              });
              return;
            }

            if (!workerId) {
              send({ type: "error", message: "register first" });
              return;
            }

            if (type === "heartbeat") {
              await prisma.worker.update({
                where: { id: workerId },
                data: {
                  status: WORKER_STATUS.online,
                  lastHeartbeatAt: new Date(),
                  connectedAppInstanceId: getAppInstanceId(),
                  cpuPct:
                    typeof msg.cpuPct === "number" ? msg.cpuPct : undefined,
                  memMb: typeof msg.memMb === "number" ? msg.memMb : undefined,
                  concurrency:
                    typeof msg.concurrency === "number"
                      ? Math.max(1, Math.min(32, msg.concurrency))
                      : undefined,
                },
              });
              if (typeof msg.activeSlots === "number") {
                hubSetSlots(workerId, msg.activeSlots);
              }
              send({ type: "heartbeat.ack" });
              return;
            }

            if (type === "job.claim") {
              const { claimJobForWorker } = await import("@/lib/jobs/claim");
              const jobId = msg.jobId ? BigInt(String(msg.jobId)) : undefined;
              const claimed = await claimJobForWorker({
                workerId,
                jobId,
                capabilities,
              });
              if (!claimed) {
                send({ type: "job.none" });
              }
              return;
            }

            if (type === "job.progress") {
              if (msg.jobId) {
                await touchLease(BigInt(String(msg.jobId)), workerId);
              }
              return;
            }

            if (type === "job.complete") {
              const { completeJob } = await import("@/lib/jobs/complete");
              const jobId = BigInt(String(msg.jobId));
              await completeJob({
                jobId,
                workerId,
                result: msg.result,
              });
              send({ type: "job.complete.ack", jobId: jobId.toString() });
              return;
            }

            if (type === "job.fail") {
              const { failJob } = await import("@/lib/jobs/complete");
              const jobId = BigInt(String(msg.jobId));
              await failJob({
                jobId,
                workerId,
                message: String(msg.message ?? "worker failed"),
              });
              send({ type: "job.fail.ack", jobId: jobId.toString() });
              return;
            }

            if (type === "health.pong") {
              hubPong(workerId);
              return;
            }
          } catch (err) {
            send({
              type: "error",
              message: err instanceof Error ? err.message : "handler error",
            });
          }
        })();
      });

      ws.on("close", () => {
        if (!workerId) return;
        const id = workerId;
        hubUnregister(id, ws);
        void prisma.worker
          .update({
            where: { id },
            data: {
              status: WORKER_STATUS.offline,
              connectedAppInstanceId: null,
            },
          })
          .catch(() => {
            /* ignore */
          });
      });
    },
  );

  return wss;
}
