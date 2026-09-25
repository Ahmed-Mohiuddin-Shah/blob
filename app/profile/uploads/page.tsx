import { StickerGrid } from "@/components/sticker-grid";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";

function typeFromMedia(kinds: string[]): string {
  if (kinds.includes("video")) return "VIDEO";
  if (kinds.includes("gif")) return "GIF";
  return "IMAGE";
}

export default async function ProfileUploadsPage() {
  const { user } = await requireSessionUser();

  const stickers = await prisma.sticker.findMany({
    where: { uploadedById: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      createdBy: { select: { displayName: true, username: true } },
      media: { select: { kind: true, status: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Your uploads</h1>
      <p className="mt-1 text-sm text-secondary">
        Everything you&apos;ve uploaded — all statuses.
      </p>
      <div className="mt-8">
        <StickerGrid
          items={stickers.map((s) => ({
            title: s.title,
            author: s.authorName || s.createdBy.displayName || s.createdBy.username,
            sourceUrl: s.sourceUrl,
            type: typeFromMedia(s.media.map((m) => m.kind)),
            href: `/stickers/${s.slug}`,
            thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
            remixHref: `/stickers/${s.slug}/remix`,
            status: `${s.moderationStatus}${s.processingStatus !== "ready" ? ` · ${s.processingStatus}` : ""}`,
          }))}
        />
      </div>
    </div>
  );
}
