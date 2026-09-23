"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canManageUsers } from "@/lib/capabilities";
import { isBlobRole, type BlobRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { setUserRole, ZitadelMgmtError } from "@/lib/zitadel-mgmt";

const STATUSES = ["active", "pending", "suspended", "banned"] as const;

export type AdminUserActionState = { ok?: boolean; error?: string };

export async function updateAdminUser(
  _prev: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return { error: "Not signed in" };

  const admin = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (
    !admin ||
    !canManageUsers({ role: admin.role, accountStatus: admin.accountStatus })
  ) {
    return { error: "Forbidden" };
  }

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  const accountStatus = String(formData.get("accountStatus") ?? "");

  if (!userId || !isBlobRole(role)) return { error: "Invalid role" };
  if (!(STATUSES as readonly string[]).includes(accountStatus)) {
    return { error: "Invalid status" };
  }

  const target = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });
  if (!target) return { error: "User not found" };

  try {
    if (role !== target.role) {
      await setUserRole(target.zitadelId, role as BlobRole);
    }
  } catch (err) {
    console.error(err);
    const msg =
      err instanceof ZitadelMgmtError
        ? `Zitadel role grant failed (${err.status})`
        : "Zitadel role grant failed";
    return { error: msg };
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { role, accountStatus },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
