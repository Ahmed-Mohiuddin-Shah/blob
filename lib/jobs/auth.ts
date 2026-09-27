import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export function hashWorkerKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Mint plaintext secret + persist hash. Caller shows secret once. */
export async function createWorkerApiKey(name: string): Promise<{
  id: bigint;
  secret: string;
  prefix: string;
}> {
  const secret = `blob_wk_${randomBytes(24).toString("base64url")}`;
  const prefix = secret.slice(0, 12);
  const row = await prisma.workerApiKey.create({
    data: {
      name: name.slice(0, 120),
      keyHash: hashWorkerKey(secret),
      prefix,
    },
  });
  return { id: row.id, secret, prefix };
}

export async function authenticateWorkerKey(secret: string): Promise<{
  apiKeyId: bigint;
  name: string;
} | null> {
  if (!secret || secret.length < 16) return null;
  const row = await prisma.workerApiKey.findUnique({
    where: { keyHash: hashWorkerKey(secret) },
  });
  if (!row || row.revokedAt) return null;
  return { apiKeyId: row.id, name: row.name };
}

export function bearerFromRequest(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}
