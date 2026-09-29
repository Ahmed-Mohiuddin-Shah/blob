"use server";

import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canManageAdmins } from "@/lib/capabilities";
import { enqueueJob } from "@/lib/jobs/enqueue";
import {
  CATALOG_REINDEX_SUBJECT_ID,
  JOB_TYPE,
} from "@/lib/jobs/types";
import { isMeiliConfigured } from "@/lib/meili/client";
import { prisma } from "@/lib/prisma";

export type ReindexActionState = {
  ok?: boolean;
  error?: string;
  queued?: number;
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

/** Superadmin: queue app-local catalog → Meili reindex (no AI enrich). */
export async function reindexCatalogAction(
  _prev: ReindexActionState,
  _formData: FormData,
): Promise<ReindexActionState> {
  const user = await requireSuperadminUser();
  if (!user) return { error: "Forbidden" };
  if (!isMeiliConfigured()) {
    return { error: "Meilisearch is not configured (MEILI_HOST / MEILI_MASTER_KEY)" };
  }
  enqueueJob(JOB_TYPE.catalogReindex, CATALOG_REINDEX_SUBJECT_ID);
  return { ok: true, queued: 1 };
}
