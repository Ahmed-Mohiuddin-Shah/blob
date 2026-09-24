"use client";

import { useState } from "react";
import { signIn } from "@zitadel/next-auth/react";
import { BusyButton } from "./busy-button";

export function SignInButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <BusyButton
      type="button"
      busy={busy}
      onClick={() => {
        setBusy(true);
        void signIn("zitadel").finally(() => setBusy(false));
      }}
      className={`rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform duration-200 hover:scale-105 ${className}`}
    >
      Log in
    </BusyButton>
  );
}

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action="/api/auth/logout" method="POST">
      <BusyButton
        type="submit"
        className={`rounded-full px-4 py-2 text-sm font-semibold text-accent-pink transition-colors hover:text-accent-orange ${className}`}
      >
        Log out
      </BusyButton>
    </form>
  );
}

export function SignOutTextButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <BusyButton
        type="submit"
        className="rounded-full px-5 py-2.5 text-sm font-semibold text-accent-pink transition-colors hover:text-accent-orange"
      >
        Log out
      </BusyButton>
    </form>
  );
}
