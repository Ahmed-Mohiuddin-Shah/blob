import type { IncomingMessage, Server as HttpServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  canUseSearchMode,
  normalizeSearchUiMode,
  type CapabilityUser,
} from "@/lib/capabilities";

export const SEARCH_WS_PATH = "/api/search/ws";

// ponytail: lazy-import auth + runners — @zitadel/next-auth is ESM-only; tsx boots
// server.ts as CJS and crashes on top-level import (ERR_PACKAGE_PATH_NOT_EXPORTED).

async function sessionUser(
  req: IncomingMessage,
): Promise<CapabilityUser | null> {
  const { getSession } = await import("@/lib/auth");
  const cookie = req.headers.cookie ?? "";
  const session = await getSession(
    new Request("http://localhost", {
      headers: { cookie },
    }),
  );
  if (!session?.user?.id) return null;
  return {
    role: session.user.role ?? "user",
    accountStatus: session.user.accountStatus ?? "active",
  };
}

export function attachSearchWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (pathname !== SEARCH_WS_PATH) return;
    void sessionUser(req).then((user) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, user);
      });
    });
  });

  wss.on(
    "connection",
    (ws: WebSocket, _req: IncomingMessage, user: CapabilityUser | null) => {
      const send = (obj: unknown) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(obj));
        }
      };

      send({ type: "hello" });

      let busy = false;

      ws.on("message", (data) => {
        void (async () => {
          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(String(data)) as Record<string, unknown>;
          } catch {
            send({ type: "error", message: "invalid json" });
            return;
          }
          if (msg.type !== "search") return;
          if (busy) {
            send({ type: "error", message: "search already running" });
            return;
          }
          busy = true;

          const mode = normalizeSearchUiMode(String(msg.mode ?? ""));
          const q = typeof msg.q === "string" ? msg.q : "";
          const mediaRaw = msg.media as
            | { mime?: string; data?: string }
            | undefined;
          const media =
            mediaRaw?.data && mediaRaw?.mime
              ? { mime: mediaRaw.mime, data: mediaRaw.data }
              : null;

          try {
            const { runVisualSearch } = await import("@/lib/search/run-visual");
            const { runAgentSearch } = await import("@/lib/search/run-agent");

            if (mode === "visual") {
              if (!canUseSearchMode(user, "visual")) {
                send({
                  type: "error",
                  message: "Visual search requires a member account",
                });
                return;
              }
              if (!media) {
                send({ type: "error", message: "visual search needs media" });
                return;
              }
              const result = await runVisualSearch({
                q,
                media,
                onStep: (label) => send({ type: "step", label }),
              });
              send({
                type: "result",
                mode: "visual",
                engine: result.engine,
                hits: result.hits,
                facetDistribution: result.facetDistribution,
                usedVisual: true,
                processedImage: result.processedImage,
              });
              return;
            }

            if (mode === "agent") {
              if (!canUseSearchMode(user, "agent")) {
                send({
                  type: "error",
                  message: "Agent search requires a member account",
                });
                return;
              }
              // Media-only → visual (more accurate, skips Ollama).
              if (media && !q.trim()) {
                const result = await runVisualSearch({
                  q: "",
                  media,
                  onStep: (label) => send({ type: "step", label }),
                });
                send({
                  type: "result",
                  mode: "visual",
                  engine: result.engine,
                  hits: result.hits,
                  facetDistribution: result.facetDistribution,
                  usedVisual: true,
                  processedImage: result.processedImage,
                  agentSkipped: true,
                });
                return;
              }
              const result = await runAgentSearch({
                q,
                media,
                user,
                onStep: (label) => send({ type: "step", label }),
              });
              send({
                type: "result",
                mode: "agent",
                plan: result.plan,
                engine: result.engine,
                hits: result.hits,
                facetDistribution: result.facetDistribution,
                usedTools: result.usedTools,
                planFallback: result.planFallback,
                usedVisual: result.usedVisual,
                processedImage: result.processedImage,
              });
              return;
            }

            send({ type: "error", message: `unsupported mode ${mode}` });
          } catch (err) {
            console.error("search ws:", err);
            const { logSearchError } = await import("@/lib/processing-log");
            logSearchError(
              `${mode || "search"}${q ? ` · ${q.slice(0, 80)}` : ""}${media ? ` · ${media.mime}` : ""}`,
              err,
            );
            send({
              type: "error",
              message: err instanceof Error ? err.message : "Search failed",
            });
          } finally {
            busy = false;
          }
        })();
      });
    },
  );

  return wss;
}
