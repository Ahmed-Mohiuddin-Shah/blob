/**
 * Next.js + worker WSS on one port (Cloudflare Tunnel friendly).
 * Dev: npm run dev → tsx server.ts
 * Prod: npm run start → tsx server.ts
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import {
  markAppInstanceOffline,
  startAppInstanceHeartbeat,
  stopAppInstanceHeartbeat,
} from "@/lib/jobs/app-instance";
import { startPgListen, stopPgListen } from "@/lib/jobs/pg-listen";
import { attachWorkerWebSocket } from "@/lib/jobs/ws-attach";
import { attachSearchWebSocket } from "@/lib/search/ws-attach";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function shutdown(): Promise<void> {
  stopAppInstanceHeartbeat();
  await markAppInstanceOffline();
  await stopPgListen();
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsed = parse(req.url!, true);
    void handle(req, res, parsed);
  });

  attachWorkerWebSocket(server);
  attachSearchWebSocket(server);

  startAppInstanceHeartbeat();
  startPgListen();

  const onSignal = () => {
    void shutdown().finally(() => process.exit(0));
  };
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);

  server.listen(port, hostname, () => {
    console.log(
      `> Ready on http://${hostname}:${port} (Next + worker/search WSS)`,
    );
  });
});
