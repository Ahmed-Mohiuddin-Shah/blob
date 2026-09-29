import { NextResponse } from "next/server";
import { canManageAdmins } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

async function requireLandingAdmin() {
  const user = await sessionUser();
  if (
    !user ||
    !canManageAdmins({ role: user.role, accountStatus: user.accountStatus })
  ) {
    return null;
  }
  return user;
}

function serialize(row: {
  featuredStickerIds: bigint[];
  categoryIds: bigint[];
  updatedAt: Date;
}) {
  return {
    featuredStickerIds: row.featuredStickerIds.map(String),
    categoryIds: row.categoryIds.map(String),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const user = await requireLandingAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.landingConfig.findUnique({
    where: { key: "default" },
  });
  if (!row) {
    return NextResponse.json({
      featuredStickerIds: [],
      categoryIds: [],
      updatedAt: null,
    });
  }
  return NextResponse.json(serialize(row));
}

export async function PUT(request: Request) {
  const user = await requireLandingAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    featuredStickerIds?: unknown;
    categoryIds?: unknown;
  } | null;

  const parseIds = (raw: unknown): bigint[] | null => {
    if (!Array.isArray(raw)) return null;
    const out: bigint[] = [];
    for (const v of raw) {
      const s = String(v).trim();
      if (!/^\d+$/.test(s)) return null;
      out.push(BigInt(s));
    }
    return out;
  };

  const featuredStickerIds = parseIds(body?.featuredStickerIds);
  const categoryIds = parseIds(body?.categoryIds);
  if (featuredStickerIds == null || categoryIds == null) {
    return NextResponse.json(
      { error: "featuredStickerIds and categoryIds must be bigint arrays" },
      { status: 400 },
    );
  }

  if (featuredStickerIds.length > 24 || categoryIds.length > 24) {
    return NextResponse.json(
      { error: "Too many ids (max 24 each)" },
      { status: 400 },
    );
  }

  const row = await prisma.landingConfig.upsert({
    where: { key: "default" },
    create: {
      key: "default",
      featuredStickerIds,
      categoryIds,
      updatedById: user.id,
    },
    update: {
      featuredStickerIds,
      categoryIds,
      updatedById: user.id,
    },
  });

  return NextResponse.json(serialize(row));
}
