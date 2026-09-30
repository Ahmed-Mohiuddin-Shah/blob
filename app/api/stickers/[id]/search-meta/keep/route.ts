import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { SEARCH_META_STATUS } from "@/lib/search/constants";
import { hasLiveMeta } from "@/lib/search/meta-draft";

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

/** Discard draft and keep live AI meta (re-approve if live exists). */
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

  const live = hasLiveMeta(sticker);
  await prisma.sticker.update({
    where: { id: sticker.id },
    data: {
      aiMetaDraft: Prisma.DbNull,
      searchMetaStatus: live
        ? SEARCH_META_STATUS.approved
        : SEARCH_META_STATUS.none,
    },
  });

  return NextResponse.json({
    ok: true,
    status: live ? SEARCH_META_STATUS.approved : SEARCH_META_STATUS.none,
  });
}
