import {
  BLOB_ROLES,
  isAdminRank,
  isBlobRole,
  isMemberRole,
  MEMBER_ROLES,
  type BlobRole,
} from "@/lib/roles";

export type CapabilityUser = {
  role: string;
  accountStatus: string;
};

export function isActive(user: CapabilityUser): boolean {
  return user.accountStatus === "active";
}

export function canUpload(user: CapabilityUser): boolean {
  return hasMinRole(user, "member");
}

export function canManageUsers(user: CapabilityUser): boolean {
  return hasMinRole(user, "admin");
}

/** Only superadmin may promote/demote admin ranks. */
export function canManageAdmins(user: CapabilityUser): boolean {
  return isActive(user) && user.role === "superadmin";
}

export function canApproveUploads(user: CapabilityUser): boolean {
  return canManageUsers(user);
}

export function canModerate(user: CapabilityUser): boolean {
  return canManageUsers(user);
}

export function hasMinRole(user: CapabilityUser, min: BlobRole): boolean {
  if (!isActive(user)) return false;
  const order: Record<BlobRole, number> = {
    user: 1,
    member: 2,
    admin: 3,
    superadmin: 4,
  };
  const rank = order[user.role as BlobRole] ?? 0;
  return rank >= order[min];
}

export type RoleChangeActor = CapabilityUser & { id: string | bigint };
export type RoleChangeTarget = CapabilityUser & { id: string | bigint };

function sameUser(a: { id: string | bigint }, b: { id: string | bigint }): boolean {
  return String(a.id) === String(b.id);
}

/**
 * Roles the actor may offer in the UI for this target.
 * Empty → role control should be read-only.
 */
export function assignableRoles(
  actor: RoleChangeActor,
  target: RoleChangeTarget,
): readonly BlobRole[] {
  if (sameUser(actor, target)) return [];
  if (!canManageUsers(actor)) return [];
  if (canManageAdmins(actor)) return BLOB_ROLES;
  if (isAdminRank(target.role)) return [];
  return MEMBER_ROLES;
}

export function canEditAccountStatus(
  actor: RoleChangeActor,
  target: RoleChangeTarget,
): boolean {
  if (!canManageUsers(actor)) return false;
  if (isAdminRank(target.role) && !canManageAdmins(actor)) return false;
  return true;
}

/**
 * Returns an error message if the role change is forbidden; null if allowed.
 * `superadminCount` is the current number of users with role superadmin.
 */
export function roleChangeError(
  actor: RoleChangeActor,
  target: RoleChangeTarget,
  nextRole: string,
  superadminCount: number,
): string | null {
  if (!isBlobRole(nextRole)) return "Invalid role";
  if (!canManageUsers(actor)) return "Forbidden";

  if (sameUser(actor, target) && nextRole !== target.role) {
    return "Cannot change your own role";
  }

  if (nextRole === target.role) return null;

  if (!canManageAdmins(actor)) {
    if (isAdminRank(target.role) || isAdminRank(nextRole)) {
      return "Only a superadmin can change admin roles";
    }
    if (!isMemberRole(nextRole)) return "Invalid role";
    return null;
  }

  // Superadmin demoting someone away from superadmin
  if (target.role === "superadmin" && nextRole !== "superadmin") {
    if (superadminCount <= 1) {
      return "Cannot demote the last superadmin";
    }
  }

  return null;
}
