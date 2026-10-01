import { SearchMetaModerationList } from "@/components/search-meta-moderation-list";
import { StickerModerationList } from "@/components/sticker-moderation-list";
import { canManageUsers } from "@/lib/capabilities";
import { MODERATION_STATUS } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";
import { SEARCH_META_STATUS } from "@/lib/search/constants";
import { parseAiMetaDraft } from "@/lib/search/meta-draft";
import { MEDIA_KIND } from "@/lib/stickers";

function typeFromMedia(kinds: string[]): string {
  if (kinds.includes(MEDIA_KIND.video)) return "VIDEO";
  if (kinds.includes(MEDIA_KIND.gif)) return "GIF";
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
      moderationStatus: MODERATION_STATUS.pendingReview,
      ...(isAdmin ? {} : { uploadedById: user.id }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      uploadedBy: { select: { displayName: true, username: true } },
      media: { select: { kind: true } },
    },
  });

  const searchMeta =
    isAdmin
      ? await prisma.sticker.findMany({
          where: { searchMetaStatus: SEARCH_META_STATUS.pendingSearchMeta },
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: {
            id: true,
            title: true,
            slug: true,
            aiCaption: true,
            aiScenario: true,
            aiVisualTags: true,
            aiMetaDraft: true,
          },
        })
      : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {isAdmin ? "Pending approval" : "Your pending uploads"}
      </h1>
      <p className="mt-1 text-sm text-secondary">
        {isAdmin
          ? "Review still previews (previous vs current when edited). History keeps notes only after approve."
          : "Waiting for an admin to review."}
      </p>
      <div className="mt-8">
        <StickerModerationList
          canModerate={isAdmin}
          items={stickers.map((s) => {
            const kinds = s.media.map((m) => m.kind);
            return {
              id: s.id.toString(),
              title: s.title,
              slug: s.slug,
              author: s.uploadedBy.displayName || s.uploadedBy.username,
              type: typeFromMedia(kinds),
              status: s.moderationStatus,
              processingStatus: s.processingStatus,
              processingError: s.processingError,
              thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
              prevThumbUrl: kinds.includes(MEDIA_KIND.prevThumbnail)
                ? `/api/stickers/${s.id}/media/${MEDIA_KIND.prevThumbnail}`
                : null,
              wasPublished: s.publishedAt != null,
              createdAt: s.createdAt.toISOString(),
            };
          })}
        />
      </div>

      {isAdmin ? (
        <div className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight">
            Search meta review
          </h2>
          <p className="mt-1 text-sm text-secondary">
            Edit AI captions from Ollama, then approve to index in Meilisearch.
          </p>
          <div className="mt-6">
            <SearchMetaModerationList
              items={searchMeta.map((s) => {
                let tags: string[] = [];
                try {
                  tags = s.aiVisualTags
                    ? (JSON.parse(s.aiVisualTags) as string[])
                    : [];
                } catch {
                  tags = [];
                }
                const draft = parseAiMetaDraft(s.aiMetaDraft);
                return {
                  id: s.id.toString(),
                  title: s.title,
                  slug: s.slug,
                  thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
                  live: {
                    caption: s.aiCaption ?? "",
                    scenario: s.aiScenario ?? "",
                    tags,
                  },
                  draft: draft
                    ? {
                        caption: draft.caption,
                        scenario: draft.scenario,
                        tags: draft.tags,
                      }
                    : null,
                };
              })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
