import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const LIMIT = 12;

/** Lazy typeahead for existing tags. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ items: [] });
  }

  const rows = await prisma.tag.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q.toLowerCase(), mode: "insensitive" } },
      ],
    },
    take: LIMIT,
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json({
    items: rows.map((t) => ({
      id: t.id.toString(),
      name: t.name,
      slug: t.slug,
    })),
  });
}
