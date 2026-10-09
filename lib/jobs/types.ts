/** Shared job / worker enums — import these; no raw string literals at call sites. */

export const JOB_TYPE = {
  compositionEncode: "composition_encode",
  sheetEncode: "sheet_encode",
  packEncode: "pack_encode",
  searchEnrich: "search_enrich",
  /** App-local only — Meili catalog reindex (Prisma + Meili). Never claim remotely. */
  catalogReindex: "catalog_reindex",
} as const;

export type JobType = (typeof JOB_TYPE)[keyof typeof JOB_TYPE];

export const JOB_TYPES = [
  JOB_TYPE.compositionEncode,
  JOB_TYPE.sheetEncode,
  JOB_TYPE.packEncode,
  JOB_TYPE.searchEnrich,
  JOB_TYPE.catalogReindex,
] as const;

/** Sentinel subjectId for single-flight catalog_reindex jobs. */
export const CATALOG_REINDEX_SUBJECT_ID = BigInt(0);

export const JOB_STATUS = {
  pending: "pending",
  leased: "leased",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const JOB_SUBJECT = {
  sticker: "sticker",
  stickerSheet: "sticker_sheet",
  stickerPack: "sticker_pack",
  catalog: "catalog",
} as const;

export type JobSubjectType = (typeof JOB_SUBJECT)[keyof typeof JOB_SUBJECT];

export const WORKER_STATUS = {
  online: "online",
  offline: "offline",
} as const;

export type WorkerStatus = (typeof WORKER_STATUS)[keyof typeof WORKER_STATUS];

export const APP_INSTANCE_STATUS = {
  online: "online",
  offline: "offline",
} as const;

export type AppInstanceStatus =
  (typeof APP_INSTANCE_STATUS)[keyof typeof APP_INSTANCE_STATUS];

/** Heartbeat freshness window for workers / app instances (default 45s). */
export function onlineSeconds(): number {
  const n = Number(process.env.WORKER_ONLINE_SECONDS ?? "45");
  return Number.isFinite(n) && n > 0 ? n : 45;
}

export function leaseSeconds(): number {
  const n = Number(process.env.WORKER_LEASE_SECONDS ?? "120");
  return Number.isFinite(n) && n > 0 ? n : 120;
}

/** True when lastHeartbeatAt is within the online window. */
export function isHeartbeatFresh(
  lastHeartbeatAt: Date | null | undefined,
  nowMs = Date.now(),
  windowSeconds = onlineSeconds(),
): boolean {
  if (!lastHeartbeatAt) return false;
  return nowMs - lastHeartbeatAt.getTime() <= windowSeconds * 1000;
}

export function idempotencyKey(type: JobType, subjectId: bigint): string {
  return `${type}:${subjectId.toString()}`;
}
