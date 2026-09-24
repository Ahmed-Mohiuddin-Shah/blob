import { ProfileNav } from "@/components/profile-nav";
import { canManageUsers, canUpload } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSessionUser();
  const caps = { role: user.role, accountStatus: user.accountStatus };
  const isAdmin = canManageUsers(caps);

  const [pendingCount, needsEditCount, claimsCount] = await Promise.all([
    prisma.sticker.count({
      where: {
        moderationStatus: "pending_review",
        ...(isAdmin ? {} : { uploadedById: user.id }),
      },
    }),
    prisma.sticker.count({
      where: {
        moderationStatus: "needs_edit",
        uploadedById: user.id,
      },
    }),
    isAdmin
      ? prisma.attributionClaim.count({ where: { status: "pending" } })
      : Promise.resolve(0),
  ]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-col gap-10 sm:flex-row sm:gap-12">
        <ProfileNav
          canUpload={canUpload(caps)}
          isAdmin={isAdmin}
          pendingCount={pendingCount}
          needsEditCount={needsEditCount}
          claimsCount={claimsCount}
          username={user.username}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </section>
  );
}
