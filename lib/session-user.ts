import { authUser } from "@/lib/auth-user";

/** Resolve signed-in app user from request headers, or null. */
export async function sessionUser() {
  return authUser();
}
