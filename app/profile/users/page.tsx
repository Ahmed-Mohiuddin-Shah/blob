import { AdminUsersTable } from "@/components/admin-users-table";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-user";

export default async function ProfileUsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Manage users</h1>
      <p className="mt-1 text-sm text-secondary">
        Role changes go to Zitadel via the service account. Account status is
        local only.
      </p>
      <div className="mt-8 max-w-3xl">
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
    </div>
  );
}
