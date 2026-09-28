import { ProfileNav } from "@/components/profile-nav";
import { CLAIM_STATUS } from "@/lib/attribution";
import { canManageAdmins, canManageUsers, canUpload } from "@/lib/capabilities";
import { MODERATION_STATUS } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";
import { SEARCH_META_STATUS } from "@/lib/search/constants";

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSessionUser();
  const caps = { role: user.role, accountStatus: user.accountStatus };
  const isAdmin = canManageUsers(caps);
  const isSuperadmin = canManageAdmins(caps);

  const [
    pendingReviewCount,
    pendingSearchMetaCount,
    needsEditCount,
    claimsCount,
    blobberEditsCount,
    blobberAssocCount,
  ] = await Promise.all([
    prisma.sticker.count({
      where: {
        moderationStatus: MODERATION_STATUS.pendingReview,
        ...(isAdmin ? {} : { uploadedById: user.id }),
      },
    }),
    isAdmin
      ? prisma.sticker.count({
          where: { searchMetaStatus: SEARCH_META_STATUS.pendingSearchMeta },
        })
      : Promise.resolve(0),
    prisma.sticker.count({
      where: {
        moderationStatus: MODERATION_STATUS.needsEdit,
        uploadedById: user.id,
      },
    }),
    isAdmin
      ? prisma.attributionClaim.count({
          where: { status: CLAIM_STATUS.pending },
        })
      : Promise.resolve(0),
    isAdmin
      ? prisma.blobberEditRequest.count({ where: { status: "pending" } })
      : Promise.resolve(0),
    isAdmin
      ? prisma.blobberAssociationRequest.count({
          where: { status: "pending" },
        })
      : Promise.resolve(0),
  ]);
  const pendingCount = pendingReviewCount + pendingSearchMetaCount;

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-col gap-10 sm:flex-row sm:gap-12">
        <ProfileNav
          canUpload={canUpload(caps)}
          isAdmin={isAdmin}
          isSuperadmin={isSuperadmin}
          pendingCount={pendingCount}
          needsEditCount={needsEditCount}
          claimsCount={claimsCount}
          blobberEditsCount={blobberEditsCount}
          blobberAssocCount={blobberAssocCount}
          username={user.username}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </section>
  );
}
