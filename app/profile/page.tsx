import Link from "next/link";
import { SignOutTextButton } from "@/components/auth-buttons";
import { ProfileEditForm } from "@/components/profile-edit-form";
import { ProfileUploads } from "@/components/profile-uploads";
import { UserBlobatar } from "@/components/user-blobatar";
import { canManageUsers, canUpload } from "@/lib/capabilities";
import { requireSessionUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const { user } = await requireSessionUser();

  const uploads = await prisma.glassUpload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const caps = { role: user.role, accountStatus: user.accountStatus };

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-lg">
        <div className="flex flex-col items-center text-center">
          <UserBlobatar
            username={user.username}
            size={96}
            className="overflow-hidden rounded-full ring-1 ring-divider"
          />

          <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
            {user.displayName}
          </h1>
          <p className="mt-1 text-sm text-secondary">@{user.username}</p>
        </div>

        <dl className="mt-10 space-y-4 border-t border-divider pt-8 text-sm">
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

        {canManageUsers(caps) ? (
          <p className="mt-6 text-center text-sm">
            <Link
              href="/admin/users"
              className="font-semibold text-accent-pink hover:underline"
            >
              Admin: manage users →
            </Link>
            {" · "}
            <Link
              href="/admin/uploads"
              className="font-semibold text-accent-pink hover:underline"
            >
              Uploads →
            </Link>
          </p>
        ) : null}

        <ProfileEditForm
          displayName={user.displayName}
          email={user.email}
          username={user.username}
        />

        <ProfileUploads
          canUpload={canUpload(caps)}
          uploads={uploads.map((u) => ({
            id: u.id.toString(),
            title: u.title,
            size: u.size,
            status: u.status,
            createdAt: u.createdAt.toISOString(),
          }))}
        />

        <div className="mt-8 flex justify-center">
          <SignOutTextButton />
        </div>
      </div>
    </section>
  );
}
