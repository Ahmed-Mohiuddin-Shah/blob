import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { SEARCH_META_STATUS } from "@/lib/search/constants";
import { upsertStickerSearch } from "@/lib/search/sync";
import { upsertBlobberSearch } from "@/lib/search/sync";

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

/** Approve searchable AI meta and upsert into Meilisearch. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    aiCaption?: string;
    aiScenario?: string;
    aiVisualTags?: string[];
  } | null;

  const sticker = await prisma.sticker.findUnique({ where: { id: BigInt(id) } });
  if (!sticker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tags = Array.isArray(body?.aiVisualTags)
    ? body.aiVisualTags
    : sticker.aiVisualTags
      ? (JSON.parse(sticker.aiVisualTags) as string[])
      : [];

  await prisma.sticker.update({
    where: { id: sticker.id },
    data: {
      aiCaption: body?.aiCaption?.trim() ?? sticker.aiCaption,
      aiScenario: body?.aiScenario?.trim() ?? sticker.aiScenario,
      aiVisualTags: JSON.stringify(tags),
      searchMetaStatus: SEARCH_META_STATUS.approved,
    },
  });

  await upsertStickerSearch(sticker.id);
  if (sticker.blobberId) {
    void upsertBlobberSearch(sticker.blobberId);
  }

  return NextResponse.json({ ok: true, status: SEARCH_META_STATUS.approved });
}
