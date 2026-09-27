import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { JOB_TYPE } from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";
import { SEARCH_META_STATUS } from "@/lib/search/constants";

async function requireAdminUser() {
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
    !canModerate({ role: user.role, accountStatus: user.accountStatus })
  ) {
    return null;
  }
  return user;
}

/** Re-queue Ollama search_enrich for a sticker (admin). */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sticker = await prisma.sticker.findUnique({ where: { id: BigInt(id) } });
  if (!sticker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.sticker.update({
    where: { id: sticker.id },
    data: { searchMetaStatus: SEARCH_META_STATUS.enriching },
  });
  enqueueJob(JOB_TYPE.searchEnrich, sticker.id);

  return NextResponse.json({ ok: true, status: SEARCH_META_STATUS.enriching });
}
