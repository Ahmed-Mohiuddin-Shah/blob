"use server";

import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canManageAdmins } from "@/lib/capabilities";
import { isMeiliConfigured } from "@/lib/meili/client";
import { prisma } from "@/lib/prisma";
import {
  reindexCatalogSearch,
  type ReindexResult,
} from "@/lib/search/reindex";

export type ReindexActionState = {
  ok?: boolean;
  error?: string;
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

/** Superadmin: push existing catalog into Meili (no AI enrich). */
export async function reindexCatalogAction(
  _prev: ReindexActionState,
  _formData: FormData,
): Promise<ReindexActionState> {
  const user = await requireSuperadminUser();
  if (!user) return { error: "Forbidden" };
  if (!isMeiliConfigured()) {
    return { error: "Meilisearch is not configured (MEILI_HOST / MEILI_MASTER_KEY)" };
  }
  try {
    const result = await reindexCatalogSearch();
    return { ok: true, result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Reindex failed",
    };
  }
}
