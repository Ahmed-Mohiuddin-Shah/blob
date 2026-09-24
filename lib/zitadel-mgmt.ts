import { BLOB_ROLES, type BlobRole } from "@/lib/roles";

export class ZitadelMgmtError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "ZitadelMgmtError";
  }
}

type MgmtConfig = {
  domain: string;
  pat: string;
  orgId: string;
  projectId: string;
};

function config(): MgmtConfig {
  const domain = process.env.ZITADEL_DOMAIN?.replace(/\/$/, "");
  const pat = process.env.ZITADEL_SERVICE_PAT;
  const orgId = process.env.ZITADEL_ORG_ID;
  const projectId = process.env.ZITADEL_PROJECT_ID;
  if (!domain || !pat || !orgId || !projectId) {
    throw new ZitadelMgmtError(
      "Missing ZITADEL_DOMAIN, ZITADEL_SERVICE_PAT, ZITADEL_ORG_ID, or ZITADEL_PROJECT_ID",
      500,
    );
  }
  return { domain, pat, orgId, projectId };
}

async function mgmtFetch(
  path: string,
  init: RequestInit & { orgId?: string } = {},
): Promise<Response> {
  const { domain, pat, orgId } = config();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${pat}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("x-zitadel-orgid", init.orgId ?? orgId);

  return fetch(`${domain}${path}`, { ...init, headers });
}

async function mgmtJson<T>(
  path: string,
  init: RequestInit & { orgId?: string } = {},
): Promise<T> {
  const res = await mgmtFetch(path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new ZitadelMgmtError(
      `Zitadel Management ${init.method ?? "GET"} ${path} → ${res.status}`,
      res.status,
      text,
    );
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

let rolesEnsured = false;

/** Ensure project roles user/member/admin/superadmin exist (idempotent). */
export async function ensureProjectRoles(): Promise<void> {
  if (rolesEnsured) return;
  const { projectId } = config();
  const listed = await mgmtJson<{ result?: { key: string }[] }>(
    `/management/v1/projects/${projectId}/roles/_search`,
    { method: "POST", body: "{}" },
  );
  const existing = new Set((listed.result ?? []).map((r) => r.key));
  for (const key of BLOB_ROLES) {
    if (existing.has(key)) continue;
    const res = await mgmtFetch(`/management/v1/projects/${projectId}/roles`, {
      method: "POST",
      body: JSON.stringify({
        roleKey: key,
        displayName: key.charAt(0).toUpperCase() + key.slice(1),
      }),
    });
    // already exists
    if (!res.ok && res.status !== 409) {
      const text = await res.text();
      if (!text.includes("AlreadyExists") && !text.includes("already")) {
        throw new ZitadelMgmtError(
          `Failed to create project role ${key}`,
          res.status,
          text,
        );
      }
    }
  }
  rolesEnsured = true;
}

type UserGrant = {
  id: string;
  projectId: string;
  roleKeys?: string[];
};

async function findProjectGrant(zitadelUserId: string): Promise<UserGrant | null> {
  const { projectId } = config();
  const data = await mgmtJson<{ result?: UserGrant[] }>(
    "/management/v1/users/grants/_search",
    {
      method: "POST",
      body: JSON.stringify({
        queries: [
          { userIdQuery: { userId: zitadelUserId } },
          { projectIdQuery: { projectId } },
        ],
      }),
    },
  );
  return data.result?.[0] ?? null;
}

/** Set the user's BLOB project grant to exactly one role key. */
export async function setUserRole(
  zitadelUserId: string,
  role: BlobRole,
): Promise<void> {
  await ensureProjectRoles();
  const { projectId } = config();
  const grant = await findProjectGrant(zitadelUserId);
  const roleKeys = [role];

  if (!grant) {
    await mgmtJson(`/management/v1/users/${zitadelUserId}/grants`, {
      method: "POST",
      body: JSON.stringify({ projectId, roleKeys }),
    });
    return;
  }

  await mgmtJson(
    `/management/v1/users/${zitadelUserId}/grants/${grant.id}`,
    {
      method: "PUT",
      body: JSON.stringify({ roleKeys }),
    },
  );
}

type HumanProfile = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
};

export async function getHumanProfile(
  zitadelUserId: string,
): Promise<HumanProfile> {
  const data = await mgmtJson<{
    firstName?: string;
    lastName?: string;
    displayName?: string;
  }>(`/management/v1/users/${zitadelUserId}/profile`);
  return data;
}

/** Update display name in Zitadel (keeps/repairs required first/last). */
export async function updateHumanDisplayName(
  zitadelUserId: string,
  displayName: string,
): Promise<void> {
  const current: HumanProfile = await getHumanProfile(zitadelUserId).catch(
    () => ({}),
  );
  const firstName =
    current.firstName?.trim() || displayName.split(/\s+/)[0] || displayName;
  const lastName =
    current.lastName?.trim() ||
    displayName.split(/\s+/).slice(1).join(" ") ||
    ".";

  await mgmtJson(`/management/v1/users/${zitadelUserId}/profile`, {
    method: "PUT",
    body: JSON.stringify({
      firstName,
      lastName,
      displayName,
    }),
  });
}

export async function updateHumanEmail(
  zitadelUserId: string,
  email: string,
  isEmailVerified = false,
): Promise<void> {
  await mgmtJson(`/management/v1/users/${zitadelUserId}/email`, {
    method: "PUT",
    body: JSON.stringify({ email, isEmailVerified }),
  });
}

export function zitadelProjectId(): string | undefined {
  return process.env.ZITADEL_PROJECT_ID;
}
