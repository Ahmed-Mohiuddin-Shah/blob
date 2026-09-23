import { requireAdmin } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { AdminUsersTable } from "@/components/admin-users-table";

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Users
      </h1>
      <p className="mt-2 text-sm text-secondary">
        Role changes go to Zitadel via the service account. Account status is
        local only.
      </p>
      <div className="mt-10 max-w-3xl">
        <AdminUsersTable
          users={users.map((u) => ({
            id: u.id.toString(),
            username: u.username,
            displayName: u.displayName,
            email: u.email,
            role: u.role,
            accountStatus: u.accountStatus,
          }))}
        />
      </div>
    </section>
  );
}
