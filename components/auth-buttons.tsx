"use client";

import { signIn } from "@zitadel/next-auth/react";

export function SignInButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signIn("zitadel")}
      className={`rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform duration-200 hover:scale-105 ${className}`}
    >
      Log in
    </button>
  );
}

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className={`rounded-full px-4 py-2 text-sm font-semibold text-secondary transition-colors hover:text-foreground ${className}`}
      >
        Log out
      </button>
    </form>
  );
}

export function SignOutTextButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className="rounded-full px-5 py-2.5 text-sm font-semibold text-secondary transition-colors hover:text-foreground"
      >
        Log out
      </button>
    </form>
  );
}
