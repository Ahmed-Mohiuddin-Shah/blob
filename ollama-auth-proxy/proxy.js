#!/usr/bin/env node
// ponytail: stdlib reverse proxy; swap for Caddy/nginx when you need TLS termination here
"use strict";

const http = require("http");

const keys = new Set(
  (process.env.OLLAMA_PROXY_API_KEYS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const listenPort = Number(process.env.LISTEN_PORT || 11434);
const upstreamHost = process.env.UPSTREAM_HOST || "127.0.0.1";
const upstreamPort = Number(process.env.UPSTREAM_PORT || 11435);

if (!keys.size) {
  console.error("OLLAMA_PROXY_API_KEYS is required (comma-separated hex keys)");
  process.exit(1);
}

function authorized(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(\S+)/i.exec(h);
  return Boolean(m && keys.has(m[1]));
}

http
  .createServer((req, res) => {
    if (!authorized(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    const headers = { ...req.headers, host: `${upstreamHost}:${upstreamPort}` };
    delete headers.authorization;

    const up = http.request(
      {
        hostname: upstreamHost,
        port: upstreamPort,
        path: req.url,
        method: req.method,
        headers,
      },
      (upRes) => {
        res.writeHead(upRes.statusCode || 502, upRes.headers);
        upRes.pipe(res);
      },
    );
    up.on("error", (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
      }
      res.end(JSON.stringify({ error: "bad_gateway", detail: String(err.message) }));
    });
    req.pipe(up);
  })
  .listen(listenPort, "0.0.0.0", () => {
    console.log(
      `ollama-auth-proxy 0.0.0.0:${listenPort} → ${upstreamHost}:${upstreamPort} (${keys.size} key(s))`,
    );
  });
