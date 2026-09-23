import type { BlobRole } from "@/lib/roles";

export type CapabilityUser = {
  role: string;
  accountStatus: string;
};

export function isActive(user: CapabilityUser): boolean {
  return user.accountStatus === "active";
}

export function canUpload(user: CapabilityUser): boolean {
  return isActive(user) && (user.role === "member" || user.role === "admin");
}

export function canManageUsers(user: CapabilityUser): boolean {
  return isActive(user) && user.role === "admin";
}

export function canApproveUploads(user: CapabilityUser): boolean {
  return canManageUsers(user);
}

export function canModerate(user: CapabilityUser): boolean {
  return canManageUsers(user);
}

export function hasMinRole(user: CapabilityUser, min: BlobRole): boolean {
  if (!isActive(user)) return false;
  const order = { user: 1, member: 2, admin: 3 } as const;
  const rank = order[user.role as BlobRole] ?? 0;
  return rank >= order[min];
}
