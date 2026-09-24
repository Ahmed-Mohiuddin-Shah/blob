"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

/** Local username only — display name / email stay on Zitadel sync. */
export async function updateUsername(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) {
    return { error: "Not signed in" };
  }

  const usernameRaw = String(formData.get("username") ?? "").trim();
  const username = slugifyUsername(usernameRaw);
  if (!username || username.length < 2) {
    return { error: "Username must be URL-safe (letters, numbers, _)" };
  }

  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (!user) return { error: "User not found" };

  const taken = await prisma.user.findFirst({
    where: { username, NOT: { id: user.id } },
  });
  if (taken) return { error: "Username already taken" };

  await prisma.user.update({
    where: { id: user.id },
    data: { username },
  });

  revalidatePath("/profile");
  revalidatePath("/profile/settings");
  return { ok: true };
}
