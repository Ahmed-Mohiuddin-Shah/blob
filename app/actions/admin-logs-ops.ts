"use server";

import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canManageAdmins } from "@/lib/capabilities";
import { enqueueCompositionEncode } from "@/lib/composition-encode";
import { enqueueJob } from "@/lib/jobs/enqueue";
import {
  CATALOG_REINDEX_SUBJECT_ID,
  JOB_TYPE,
} from "@/lib/jobs/types";
import { isMeiliConfigured } from "@/lib/meili/client";
import { prisma } from "@/lib/prisma";
import { SEARCH_META_STATUS } from "@/lib/search/constants";
import type { ReindexResult } from "@/lib/search/reindex";
import {
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
  PROCESSING_STATUS,
} from "@/lib/stickers";

export type LogsOpState = {
  ok?: boolean;
  error?: string;
  queued?: number;
  result?: ReindexResult;
};

async function requireSuperadminUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (
    !user ||
    !canManageAdmins({ role: user.role, accountStatus: user.accountStatus })
  ) {
    return null;
  }
  return user;
}

/** Stickers with full image but no ready og (includes failed “no free slots”). */
function missingOgWhere() {
  return {
    // Skip in-flight encodes; include failed leftovers from concurrency races.
    processingStatus: {
      in: [PROCESSING_STATUS.ready, PROCESSING_STATUS.failed],
    },
    media: {
      some: {
        kind: MEDIA_KIND.image,
        status: MEDIA_ASSET_STATUS.ready,
      },
      none: {
        kind: MEDIA_KIND.og,
        status: MEDIA_ASSET_STATUS.ready,
      },
    },
  };
}

export async function countMissingWhatsAppOg(): Promise<number> {
  const user = await requireSuperadminUser();
  if (!user) return 0;
  return prisma.sticker.count({ where: missingOgWhere() });
}

/** Stickers needing AI search enrich. */
export async function countMissingSearchMeta(): Promise<number> {
  const user = await requireSuperadminUser();
  if (!user) return 0;
  return prisma.sticker.count({
    where: {
      searchMetaStatus: {
        in: [SEARCH_META_STATUS.none, SEARCH_META_STATUS.stale],
      },
    },
  });
}

/** Stickers with ready gif or video media (format-matrix re-encode scope). */
function animatedMediaWhere() {
  return {
    media: {
      some: {
        kind: { in: [MEDIA_KIND.gif, MEDIA_KIND.video] },
        status: MEDIA_ASSET_STATUS.ready,
      },
    },
  };
}

export async function countAnimatedMediaStickers(): Promise<number> {
  const user = await requireSuperadminUser();
  if (!user) return 0;
  return prisma.sticker.count({ where: animatedMediaWhere() });
}

export async function reindexCatalogAction(
  _prev: LogsOpState,
  _formData: FormData,
): Promise<LogsOpState> {
  const user = await requireSuperadminUser();
  if (!user) return { error: "Forbidden" };
  if (!isMeiliConfigured()) {
    return {
      error: "Meilisearch is not configured (MEILI_HOST / MEILI_MASTER_KEY)",
    };
  }
  enqueueJob(JOB_TYPE.catalogReindex, CATALOG_REINDEX_SUBJECT_ID);
  return { ok: true, queued: 1 };
}

export async function backfillWhatsAppOgAction(
  _prev: LogsOpState,
  _formData: FormData,
): Promise<LogsOpState> {
  const user = await requireSuperadminUser();
  if (!user) return { error: "Forbidden" };

  const batch = 200;
  let queued = 0;
  let cursor: bigint | undefined;

  for (;;) {
    const rows = await prisma.sticker.findMany({
      where: {
        ...missingOgWhere(),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: batch,
      select: { id: true },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      await prisma.sticker.update({
        where: { id: row.id },
        data: {
          processingStatus: PROCESSING_STATUS.processing,
          processingError: null,
        },
      });
      enqueueCompositionEncode(row.id);
      queued += 1;
    }
    cursor = rows[rows.length - 1]!.id;
  }

  return { ok: true, queued };
}

export async function enrichMissingSearchMetaAction(
  _prev: LogsOpState,
  _formData: FormData,
): Promise<LogsOpState> {
  const user = await requireSuperadminUser();
  if (!user) return { error: "Forbidden" };

  const batch = 200;
  let queued = 0;
  let cursor: bigint | undefined;

  for (;;) {
    const rows = await prisma.sticker.findMany({
      where: {
        searchMetaStatus: {
          in: [SEARCH_META_STATUS.none, SEARCH_META_STATUS.stale],
        },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: batch,
      select: { id: true },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      await prisma.sticker.update({
        where: { id: row.id },
        data: { searchMetaStatus: SEARCH_META_STATUS.enriching },
      });
      enqueueJob(JOB_TYPE.searchEnrich, row.id);
      queued += 1;
    }
    cursor = rows[rows.length - 1]!.id;
  }

  return { ok: true, queued };
}

export async function reencodeAnimatedMediaAction(
  _prev: LogsOpState,
  _formData: FormData,
): Promise<LogsOpState> {
  const user = await requireSuperadminUser();
  if (!user) return { error: "Forbidden" };

  const batch = 200;
  let queued = 0;
  let cursor: bigint | undefined;

  for (;;) {
    const rows = await prisma.sticker.findMany({
      where: {
        ...animatedMediaWhere(),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: batch,
      select: { id: true },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      await prisma.sticker.update({
        where: { id: row.id },
        data: {
          processingStatus: PROCESSING_STATUS.processing,
          processingError: null,
        },
      });
      enqueueCompositionEncode(row.id);
      queued += 1;
    }
    cursor = rows[rows.length - 1]!.id;
  }

  return { ok: true, queued };
}
