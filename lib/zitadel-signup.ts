import { attributesFromClaims } from "@/lib/zitadel-user-mapper";
import {
  ACCOUNT_STATUS,
  BLOB_ROLE,
  rolesFromClaims,
  type BlobRole,
} from "@/lib/roles";
import { setUserRole, zitadelProjectId } from "@/lib/zitadel-mgmt";

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

type PrismaClient = Awaited<ReturnType<typeof getPrisma>>;

/**
 * One-shot: if no local superadmin exists, promote the lowest-id admin
 * via Zitadel + local mirror. Returns that user's id when promoted.
 */
async function ensureBootstrapSuperadmin(
  prisma: PrismaClient,
): Promise<bigint | null> {
  const has = await prisma.user.findFirst({
    where: { role: BLOB_ROLE.superadmin },
    select: { id: true },
  });
  if (has) return null;

  const firstAdmin = await prisma.user.findFirst({
    where: { role: BLOB_ROLE.admin },
    orderBy: { id: "asc" },
  });
  if (!firstAdmin) return null;

  try {
    await setUserRole(firstAdmin.zitadelId, BLOB_ROLE.superadmin);
  } catch (err) {
    console.warn("Zitadel bootstrap superadmin skipped:", err);
  }
  await prisma.user.update({
    where: { id: firstAdmin.id },
    data: { role: BLOB_ROLE.superadmin },
  });
  return firstAdmin.id;
}

/** Upsert local user from OIDC claims (login callback). */
export async function upsertUserFromClaims(
  claims: Record<string, unknown>,
): Promise<{ zitadelId: string }> {
  const sub = claims.sub;
  if (typeof sub !== "string" || !sub) {
    throw new Error("OIDC claims missing sub");
  }

  const prisma = await getPrisma();
  const attrs = attributesFromClaims({
    sub,
    name: typeof claims.name === "string" ? claims.name : undefined,
    email: typeof claims.email === "string" ? claims.email : undefined,
    email_verified: Boolean(claims.email_verified),
    preferred_username:
      typeof claims.preferred_username === "string"
        ? claims.preferred_username
        : undefined,
  });

  const claimedRole = rolesFromClaims(claims, zitadelProjectId());

  const existing = await prisma.user.findUnique({
    where: { zitadelId: attrs.zitadelId },
  });

  if (!existing) {
    const userCount = await prisma.user.count();
    const role: BlobRole =
      userCount === 0 ? BLOB_ROLE.superadmin : claimedRole;
    await prisma.user.create({
      data: {
        zitadelId: attrs.zitadelId,
        username: attrs.username,
        displayName: attrs.displayName,
        email: attrs.email,
        emailVerifiedAt: attrs.emailVerifiedAt,
        role,
        accountStatus: ACCOUNT_STATUS.active,
      },
    });
    try {
      await setUserRole(attrs.zitadelId, role);
    } catch (err) {
      console.warn("Zitadel setUserRole on signup skipped:", err);
    }
  } else {
    const promotedId = await ensureBootstrapSuperadmin(prisma);
    let role: BlobRole = claimedRole;
    if (promotedId !== null && existing.id === promotedId) {
      role = BLOB_ROLE.superadmin;
    } else if (existing.role === BLOB_ROLE.superadmin) {
      role = BLOB_ROLE.superadmin;
      if (claimedRole !== BLOB_ROLE.superadmin) {
        try {
          await setUserRole(attrs.zitadelId, BLOB_ROLE.superadmin);
        } catch (err) {
          console.warn("Zitadel re-assert superadmin skipped:", err);
        }
      }
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        displayName: attrs.displayName,
        email: attrs.email,
        emailVerifiedAt: attrs.emailVerifiedAt,
        role,
      },
    });
  }

  return { zitadelId: attrs.zitadelId };
}
