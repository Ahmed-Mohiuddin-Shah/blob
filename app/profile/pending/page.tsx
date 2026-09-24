import { StickerModerationList } from "@/components/sticker-moderation-list";
import { canManageUsers } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";

function typeFromMedia(kinds: string[]): string {
  if (kinds.includes("video")) return "VIDEO";
  if (kinds.includes("gif")) return "GIF";
  return "IMAGE";
}

export default async function ProfilePendingPage() {
  const { user } = await requireSessionUser();
  const isAdmin = canManageUsers({
    role: user.role,
    accountStatus: user.accountStatus,
  });

  const stickers = await prisma.sticker.findMany({
    where: {
      moderationStatus: "pending_review",
      ...(isAdmin ? {} : { uploadedById: user.id }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      uploadedBy: { select: { displayName: true, username: true } },
      media: { select: { kind: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {isAdmin ? "Pending approval" : "Your pending uploads"}
      </h1>
      <p className="mt-1 text-sm text-secondary">
        {isAdmin
          ? "Review and approve or reject submissions."
          : "Waiting for an admin to review."}
      </p>
      <div className="mt-8">
        <StickerModerationList
          canModerate={isAdmin}
          items={stickers.map((s) => ({
            id: s.id.toString(),
            title: s.title,
            slug: s.slug,
            author: s.uploadedBy.displayName || s.uploadedBy.username,
            type: typeFromMedia(s.media.map((m) => m.kind)),
            status: s.moderationStatus,
            processingStatus: s.processingStatus,
            thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
            createdAt: s.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
