"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import {
  canEditAccountStatus,
  canManageUsers,
  roleChangeError,
} from "@/lib/capabilities";
import {
  isBlobRole,
  ACCOUNT_STATUSES,
  BLOB_ROLE,
  type BlobRole,
} from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { setUserRole, ZitadelMgmtError } from "@/lib/zitadel-mgmt";

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
  if (!(ACCOUNT_STATUSES as readonly string[]).includes(accountStatus)) {
    return { error: "Invalid status" };
  }

  const target = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });
  if (!target) return { error: "User not found" };

  const actor = {
    id: admin.id,
    role: admin.role,
    accountStatus: admin.accountStatus,
  };
  const targetCaps = {
    id: target.id,
    role: target.role,
    accountStatus: target.accountStatus,
  };

  const superadminCount = await prisma.user.count({
    where: { role: BLOB_ROLE.superadmin },
  });
  const roleErr = roleChangeError(actor, targetCaps, role, superadminCount);
  if (roleErr) return { error: roleErr };

  let nextStatus = accountStatus;
  if (accountStatus !== target.accountStatus) {
    if (!canEditAccountStatus(actor, targetCaps)) {
      return { error: "Only a superadmin can change another user's status" };
    }
  } else if (!canEditAccountStatus(actor, targetCaps)) {
    // Status field locked in UI; keep existing.
    nextStatus = target.accountStatus;
  }

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
    data: { role, accountStatus: nextStatus },
  });

  revalidatePath("/profile/users");
  revalidatePath("/admin/users");
  return { ok: true };
}
