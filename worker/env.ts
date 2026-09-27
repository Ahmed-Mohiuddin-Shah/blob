import { JOB_TYPES, type JobType } from "../lib/jobs/types";

export type WorkerEnv = {
  blobUrl: string;
  workerApiKey: string;
  glassApiUrl: string;
  glassApiKey: string;
  concurrency: number;
  capabilities: JobType[];
};

export function loadWorkerEnv(): WorkerEnv {
  const blobUrl = (process.env.BLOB_URL ?? "").replace(/\/$/, "");
  const workerApiKey = process.env.WORKER_API_KEY ?? "";
  const glassApiUrl = (process.env.GLASS_API_URL ?? "").replace(/\/$/, "");
  const glassApiKey = process.env.GLASS_API_KEY ?? "";

  if (!blobUrl) throw new Error("BLOB_URL is required");
  if (!workerApiKey) throw new Error("WORKER_API_KEY is required");
  if (!glassApiUrl) throw new Error("GLASS_API_URL is required");
  if (!glassApiKey) throw new Error("GLASS_API_KEY is required");

  const concurrency = Math.max(
    1,
    Math.min(32, Number(process.env.WORKER_CONCURRENCY ?? "1") || 1),
  );

  const raw = process.env.WORKER_CAPABILITIES?.trim();
  const capabilities = (
    raw
      ? raw.split(",").map((s) => s.trim())
      : [...JOB_TYPES]
  ).filter((c): c is JobType =>
    (JOB_TYPES as readonly string[]).includes(c),
  );

  if (capabilities.length === 0) {
    throw new Error("WORKER_CAPABILITIES produced no valid job types");
  }

  return {
    blobUrl,
    workerApiKey,
    glassApiUrl,
    glassApiKey,
    concurrency,
    capabilities,
  };
}

export function wsUrl(blobUrl: string, token: string): string {
  const u = new URL(blobUrl);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/api/workers/ws";
  u.search = `token=${encodeURIComponent(token)}`;
  return u.toString();
}
