"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  updateHumanDisplayName,
  updateHumanEmail,
  ZitadelMgmtError,
} from "@/lib/zitadel-mgmt";

function slugifyUsername(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export type ProfileActionState = { ok?: boolean; error?: string };

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id || !session.user) {
    return { error: "Not signed in" };
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const usernameRaw = String(formData.get("username") ?? "").trim();
  const username = slugifyUsername(usernameRaw);

  if (!displayName || displayName.length > 100) {
    return { error: "Display name required (max 100)" };
  }
  if (!email || !email.includes("@") || email.length > 255) {
    return { error: "Valid email required" };
  }
  if (!username || username.length < 2) {
    return { error: "Username must be URL-safe (letters, numbers, _)" };
  }

  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (!user) return { error: "User not found" };

  const taken = await prisma.user.findFirst({
    where: {
      username,
      NOT: { id: user.id },
    },
  });
  if (taken) return { error: "Username already taken" };

  const emailTaken = await prisma.user.findFirst({
    where: { email, NOT: { id: user.id } },
  });
  if (emailTaken) return { error: "Email already in use" };

  try {
    if (displayName !== user.displayName) {
      await updateHumanDisplayName(user.zitadelId, displayName);
    }
    if (email !== user.email) {
      await updateHumanEmail(user.zitadelId, email, false);
    }
  } catch (err) {
    const msg =
      err instanceof ZitadelMgmtError
        ? `Zitadel update failed (${err.status})`
        : "Zitadel update failed";
    console.error(err);
    return { error: msg };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName,
      email,
      username,
      emailVerifiedAt: email !== user.email ? null : user.emailVerifiedAt,
    },
  });

  revalidatePath("/profile");
  return { ok: true };
}
