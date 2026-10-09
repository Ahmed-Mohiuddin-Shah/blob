import { redirect } from "next/navigation";
import { authUser } from "@/lib/auth-user";
import { signInUrl } from "@/lib/auth-urls";
import {
  canManageAdmins,
  canManageUsers,
  type CapabilityUser,
} from "@/lib/capabilities";

export async function requireSessionUser() {
  const user = await authUser();
  if (!user) {
    redirect(signInUrl({ redirectTo: "/profile" }));
  }
  return {
    session: {
      user: {
        id: user.id.toString(),
        name: user.displayName,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    },
    user,
  };
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
