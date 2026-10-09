"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canManageAdmins, canManageUsers } from "@/lib/capabilities";
import { createWorkerApiKey } from "@/lib/jobs/auth";
import { pingWorkerCrossInstance } from "@/lib/jobs/pg-listen";
import { prisma } from "@/lib/prisma";

export type WorkerKeyActionState = {
  ok?: boolean;
  error?: string;
  secret?: string;
  prefix?: string;
  name?: string;
};

async function actor() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
}

export async function createWorkerKeyAction(
  _prev: WorkerKeyActionState,
  formData: FormData,
): Promise<WorkerKeyActionState> {
  const user = await actor();
  if (
    !user ||
    !canManageAdmins({ role: user.role, accountStatus: user.accountStatus })
  ) {
    return { error: "Forbidden" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name required" };

  const created = await createWorkerApiKey(name);
  revalidatePath("/profile/workers");
  return {
    ok: true,
    secret: created.secret,
    prefix: created.prefix,
    name,
  };
}

export async function revokeWorkerKeyAction(
  _prev: WorkerKeyActionState,
  formData: FormData,
): Promise<WorkerKeyActionState> {
  const user = await actor();
  if (
    !user ||
    !canManageAdmins({ role: user.role, accountStatus: user.accountStatus })
  ) {
    return { error: "Forbidden" };
  }

  const id = String(formData.get("keyId") ?? "");
  if (!id) return { error: "Missing key" };

  await prisma.workerApiKey.update({
    where: { id: BigInt(id) },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/profile/workers");
  return { ok: true };
}

export type HealthPingState = { ok?: boolean; error?: string; alive?: boolean };

export async function pingWorkerAction(
  _prev: HealthPingState,
  formData: FormData,
): Promise<HealthPingState> {
  const user = await actor();
  if (
    !user ||
    !canManageAdmins({ role: user.role, accountStatus: user.accountStatus })
  ) {
    return { error: "Forbidden" };
  }

  const id = String(formData.get("workerId") ?? "");
  if (!id) return { error: "Missing worker" };

  // Also allow admins to view — but ping is superadmin-only per plan
  if (
    !canManageUsers({ role: user.role, accountStatus: user.accountStatus })
  ) {
    return { error: "Forbidden" };
  }

  const alive = await pingWorkerCrossInstance(BigInt(id));
  return { ok: true, alive };
}
