/**
 * Next.js + worker WSS on one port (Cloudflare Tunnel friendly).
 * Dev: npm run dev → tsx server.ts
 * Prod: npm run start → tsx server.ts
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { attachWorkerWebSocket } from "@/lib/jobs/ws-attach";
import { attachSearchWebSocket } from "@/lib/search/ws-attach";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsed = parse(req.url!, true);
    void handle(req, res, parsed);
  });

  attachWorkerWebSocket(server);
  attachSearchWebSocket(server);

  server.listen(port, hostname, () => {
    console.log(
      `> Ready on http://${hostname}:${port} (Next + worker/search WSS)`,
    );
  });
});
