/** Client-safe auth path helpers (no Node/Prisma/OIDC imports). */

export function signInUrl(opts?: { redirectTo?: string }): string {
  const base = "/api/auth/signin";
  if (!opts?.redirectTo) return base;
  return `${base}?redirectTo=${encodeURIComponent(opts.redirectTo)}`;
}

export function signOutUrl(): string {
  return "/api/auth/logout";
}
