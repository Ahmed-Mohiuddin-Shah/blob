import {
  ACCOUNT_STATUS,
  APP_ASSIGNABLE_ROLES,
  BLOB_ROLE,
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
  return user.accountStatus === ACCOUNT_STATUS.active;
}

export function canUpload(user: CapabilityUser): boolean {
  return hasMinRole(user, BLOB_ROLE.member);
}

export function canManageUsers(user: CapabilityUser): boolean {
  return hasMinRole(user, BLOB_ROLE.admin);
}

/** Only superadmin may promote/demote admin ranks. */
export function canManageAdmins(user: CapabilityUser): boolean {
  return isActive(user) && user.role === BLOB_ROLE.superadmin;
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
    [BLOB_ROLE.user]: 1,
    [BLOB_ROLE.member]: 2,
    [BLOB_ROLE.admin]: 3,
    [BLOB_ROLE.superadmin]: 4,
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
  // superadmin is never assignable in-app (Zitadel / bootstrap only)
  if (canManageAdmins(actor)) return APP_ASSIGNABLE_ROLES;
  if (isAdminRank(target.role)) return [];
  return MEMBER_ROLES;
}

export function canEditAccountStatus(
  actor: RoleChangeActor,
  target: RoleChangeTarget,
): boolean {
  if (sameUser(actor, target)) return false;
  return canManageAdmins(actor);
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

  // Promoting to superadmin is Zitadel-only — never via BLOB UI/API
  if (nextRole === BLOB_ROLE.superadmin) {
    return "superadmin can only be assigned in Zitadel";
  }

  if (!canManageAdmins(actor)) {
    if (isAdminRank(target.role) || isAdminRank(nextRole)) {
      return "Only a superadmin can change admin roles";
    }
    if (!isMemberRole(nextRole)) return "Invalid role";
    return null;
  }

  // Superadmin demoting someone away from superadmin
  if (target.role === BLOB_ROLE.superadmin) {
    if (superadminCount <= 1) {
      return "Cannot demote the last superadmin";
    }
  }

  return null;
}
