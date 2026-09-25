/** Prints domain: sticker sheets + packs. Always public. Not deletable. */

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/stickers";

export const PRINT_STATUS = {
  pending: "pending",
  ready: "ready",
  failed: "failed",
} as const;
export type PrintStatus = (typeof PRINT_STATUS)[keyof typeof PRINT_STATUS];

export const PRINT_STATUSES = [
  PRINT_STATUS.pending,
  PRINT_STATUS.ready,
  PRINT_STATUS.failed,
] as const;

export const PRINT_FORMAT = {
  pdf: "pdf",
  png: "png",
} as const;
export type PrintFormat = (typeof PRINT_FORMAT)[keyof typeof PRINT_FORMAT];

export const PRINT_FORMATS = [PRINT_FORMAT.pdf, PRINT_FORMAT.png] as const;

export const MAX_SHEET_STICKERS = 20;
export const MIN_SHEET_STICKERS = 1;
export const MIN_PACK_SHEETS = 2;

/** Order-insensitive fingerprint of pack membership (sorted sheet ids → sha256 hex). */
export function packSheetsHash(ids: bigint[]): string {
  const key = [...ids]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((id) => id.toString())
    .join(",");
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Ordered unique sheet ids from direct sheets + pack expansions.
 * Skips `excludePackId` so a collection-linked pack is never nested into itself.
 */
export function mergePackSheetIds(opts: {
  sheetIds: bigint[];
  packs: { id: bigint; sheetIds: bigint[] }[];
  excludePackId?: bigint | null;
}): bigint[] {
  const ordered: bigint[] = [];
  const seen = new Set<string>();
  for (const id of opts.sheetIds) {
    const key = id.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(id);
  }
  for (const pack of opts.packs) {
    if (opts.excludePackId != null && pack.id === opts.excludePackId) continue;
    for (const sheetId of pack.sheetIds) {
      const key = sheetId.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push(sheetId);
    }
  }
  return ordered;
}

export function parsePrintFormat(raw: unknown): PrintFormat | null {
  if (typeof raw !== "string") return null;
  return PRINT_FORMATS.includes(raw as PrintFormat)
    ? (raw as PrintFormat)
    : null;
}

export function selectionHasNonPublic(
  stickers: { visibility: string }[],
): boolean {
  return stickers.some((s) => s.visibility !== "public");
}

export async function uniqueSheetSlug(name: string): Promise<string> {
  const baseSlug = slugify(name, 220);
  let slug = baseSlug;
  for (let i = 0; i < 8; i++) {
    const taken = await prisma.stickerSheet.findUnique({ where: { slug } });
    if (!taken) return slug;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

export async function uniquePackSlug(name: string): Promise<string> {
  const baseSlug = slugify(name, 220);
  let slug = baseSlug;
  for (let i = 0; i < 8; i++) {
    const taken = await prisma.stickerPack.findUnique({ where: { slug } });
    if (!taken) return slug;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

export function serializeSheet(s: {
  id: bigint;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  errorMessage?: string | null;
  pngGlassObjectId: string | null;
  pdfGlassObjectId: string | null;
  createdAt: Date;
  createdBy?: { username: string; displayName: string };
  stickers?: { stickerId: bigint }[];
}) {
  const ready = s.status === PRINT_STATUS.ready;
  return {
    id: s.id.toString(),
    name: s.name,
    slug: s.slug,
    description: s.description,
    status: s.status,
    errorMessage: s.errorMessage ?? null,
    href: `/prints/sheets/${s.slug}`,
    author: s.createdBy
      ? s.createdBy.displayName || s.createdBy.username
      : undefined,
    username: s.createdBy?.username,
    stickerCount: s.stickers?.length ?? undefined,
    previewUrl: ready
      ? `/api/sheets/${s.id}/media/png`
      : null,
    pngGlassObjectId: s.pngGlassObjectId,
    pdfGlassObjectId: s.pdfGlassObjectId,
    createdAt: s.createdAt.toISOString(),
  };
}

export function serializePack(p: {
  id: bigint;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  errorMessage?: string | null;
  pngGlassObjectId: string | null;
  pdfGlassObjectId: string | null;
  createdAt: Date;
  createdBy?: { username: string; displayName: string };
  sheets?: { sheetId: bigint }[];
}) {
  const ready = p.status === PRINT_STATUS.ready;
  return {
    id: p.id.toString(),
    name: p.name,
    slug: p.slug,
    description: p.description,
    status: p.status,
    errorMessage: p.errorMessage ?? null,
    href: `/prints/packs/${p.slug}`,
    author: p.createdBy
      ? p.createdBy.displayName || p.createdBy.username
      : undefined,
    username: p.createdBy?.username,
    sheetCount: p.sheets?.length ?? undefined,
    previewUrl: ready
      ? `/api/packs/${p.id}/media/png`
      : null,
    pngGlassObjectId: p.pngGlassObjectId,
    pdfGlassObjectId: p.pdfGlassObjectId,
    createdAt: p.createdAt.toISOString(),
  };
}
