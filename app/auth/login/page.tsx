"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BusyButton } from "@/components/busy-button";
import { signInUrl } from "@/lib/auth-urls";

function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") ?? "/profile";
  const href = signInUrl({ redirectTo: callbackUrl });
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-secondary">
        {error
          ? "Something went wrong. Try signing in again."
          : "Continue with your Zitadel account"}
      </p>

      <BusyButton
        type="button"
        busy={busy}
        onClick={() => {
          setBusy(true);
          window.location.assign(href);
        }}
        className="mt-8 w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform duration-200 hover:scale-105"
      >
        Sign in with Zitadel
      </BusyButton>

      <Link
        href="/"
        className="mt-6 text-sm text-secondary transition-colors hover:text-foreground"
      >
        Back to home
      </Link>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-center text-sm text-secondary">Loading…</p>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
