import { NextResponse } from "next/server";
import { canManageAdmins } from "@/lib/capabilities";
import { sessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

const PAGE = 24;

/** Superadmin: append-only processing/encode failure logs. */
export async function GET(request: Request) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAdmins({ role: user.role, accountStatus: user.accountStatus })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const cursor = url.searchParams.get("cursor");

  const where = q
    ? {
        OR: [
          { subjectTitle: { contains: q, mode: "insensitive" as const } },
          { message: { contains: q, mode: "insensitive" as const } },
          { subjectType: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const rows = await prisma.processingLog.findMany({
    where,
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;

  return NextResponse.json({
    items: page.map((r) => ({
      id: r.id.toString(),
      subjectType: r.subjectType,
      subjectId: r.subjectId.toString(),
      subjectTitle: r.subjectTitle,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
  });
}
