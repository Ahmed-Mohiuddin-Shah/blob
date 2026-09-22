import { auth } from "@/auth";
import { SignOutTextButton } from "@/components/auth-buttons";
import { UserBlobatar } from "@/components/user-blobatar";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin/zitadel?callbackUrl=/profile");

  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });

  if (!user) redirect("/api/auth/signin/zitadel?callbackUrl=/profile");

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-lg">
        <div className="flex flex-col items-center text-center">
          <UserBlobatar
            username={user.username}
            size={96}
            className="overflow-hidden rounded-full ring-1 ring-divider"
          />

          <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">{user.displayName}</h1>
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
            <dd className="font-medium capitalize">{user.accountStatus.replaceAll("_", " ")}</dd>
          </div>
        </dl>

        <p className="mt-8 text-center text-sm leading-6 text-secondary">
          Name and email are managed in your Zitadel account. Your blobatar is generated from your username.
        </p>

        <div className="mt-8 flex justify-center">
          <SignOutTextButton />
        </div>
      </div>
    </section>
  );
}
