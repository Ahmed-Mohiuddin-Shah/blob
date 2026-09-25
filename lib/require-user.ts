import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, signInUrl } from "@/lib/auth";
import { canManageAdmins, canManageUsers, type CapabilityUser } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";

export async function requireSessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) {
    redirect(signInUrl({ redirectTo: "/profile" }));
  }
  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (!user) {
    redirect(signInUrl({ redirectTo: "/profile" }));
  }
  return { session, user };
}

export async function requireAdmin() {
  const { session, user } = await requireSessionUser();
  const cap: CapabilityUser = {
    role: user.role,
    accountStatus: user.accountStatus,
  };
  if (!canManageUsers(cap)) {
    redirect("/profile");
  }
  return { session, user };
}

export async function requireSuperadmin() {
  const { session, user } = await requireSessionUser();
  const cap: CapabilityUser = {
    role: user.role,
    accountStatus: user.accountStatus,
  };
  if (!canManageAdmins(cap)) {
    redirect("/profile");
  }
  return { session, user };
}
