import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";

const PAGE = 30;

/** Admin paginated moderation history (polymorphic). */
export async function GET(request: Request) {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (
    !admin ||
    !canModerate({ role: admin.role, accountStatus: admin.accountStatus })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const subjectType = (url.searchParams.get("subjectType") ?? "").trim();
  const action = (url.searchParams.get("action") ?? "").trim();
  const subjectIdRaw = (url.searchParams.get("subjectId") ?? "").trim();

  const where: {
    subjectType?: string;
    action?: string;
    subjectId?: bigint;
  } = {};
  if (subjectType) where.subjectType = subjectType;
  if (action) where.action = action;
  if (subjectIdRaw) {
    try {
      where.subjectId = BigInt(subjectIdRaw);
    } catch {
      return NextResponse.json({ error: "Invalid subjectId" }, { status: 400 });
    }
  }

  const rows = await prisma.moderationEvent.findMany({
    where,
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      actor: { select: { username: true, displayName: true } },
    },
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.id.toString() : null;

  return NextResponse.json({
    items: page.map((e) => ({
      id: e.id.toString(),
      subjectType: e.subjectType,
      subjectId: e.subjectId.toString(),
      subjectTitle: e.subjectTitle,
      action: e.action,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
      actor: {
        username: e.actor.username,
        displayName: e.actor.displayName,
      },
    })),
    nextCursor,
  });
}
