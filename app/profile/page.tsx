import Link from "next/link";
import { SignOutTextButton } from "@/components/auth-buttons";
import { UserBlobatar } from "@/components/user-blobatar";
import { canUpload } from "@/lib/capabilities";
import { requireSessionUser } from "@/lib/require-user";

export default async function ProfileOverviewPage() {
  const { user } = await requireSessionUser();
  const caps = { role: user.role, accountStatus: user.accountStatus };

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
          {canUpload(caps) ? (
            <div className="mt-4">
              <Link
                href="/upload"
                className="inline-flex rounded-full bg-accent-gradient px-5 py-2 text-sm font-semibold text-white"
              >
                Upload sticker
              </Link>
            </div>
          ) : null}
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
