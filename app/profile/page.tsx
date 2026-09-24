import Link from "next/link";
import { SignOutTextButton } from "@/components/auth-buttons";
import { UserBlobatar } from "@/components/user-blobatar";
import { canManageUsers, canUpload } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";

export default async function ProfileOverviewPage() {
  const { user } = await requireSessionUser();
  const caps = { role: user.role, accountStatus: user.accountStatus };

  const [uploadCount, pendingCount] = await Promise.all([
    prisma.sticker.count({ where: { uploadedById: user.id } }),
    prisma.sticker.count({
      where: {
        moderationStatus: "pending_review",
        ...(canManageUsers(caps) ? {} : { uploadedById: user.id }),
      },
    }),
  ]);

  return (
    <div>
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <UserBlobatar
          username={user.username}
          size={96}
          className="overflow-hidden rounded-full ring-1 ring-divider"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {user.displayName}
          </h1>
          <p className="mt-1 text-sm text-secondary">@{user.username}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canUpload(caps) ? (
              <Link
                href="/upload"
                className="rounded-full bg-accent-gradient px-5 py-2 text-sm font-semibold text-white"
              >
                Upload sticker
              </Link>
            ) : null}
            <Link
              href="/profile/uploads"
              className="rounded-full border border-divider bg-surface px-5 py-2 text-sm font-semibold"
            >
              Uploads ({uploadCount})
            </Link>
            <Link
              href="/profile/pending"
              className="rounded-full border border-divider bg-surface px-5 py-2 text-sm font-semibold"
            >
              Pending
              {pendingCount > 0 ? ` (${pendingCount})` : ""}
            </Link>
            <Link
              href="/profile/settings"
              className="rounded-full border border-divider bg-surface px-5 py-2 text-sm font-semibold"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>

      <dl className="mt-10 max-w-md space-y-4 border-t border-divider pt-8 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-secondary">Email</dt>
          <dd className="truncate font-medium">{user.email}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-secondary">Role</dt>
          <dd className="font-medium capitalize">{user.role}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-secondary">Status</dt>
          <dd className="font-medium capitalize">
            {user.accountStatus.replaceAll("_", " ")}
          </dd>
        </div>
      </dl>

      <div className="mt-8">
        <SignOutTextButton />
      </div>
    </div>
  );
}
