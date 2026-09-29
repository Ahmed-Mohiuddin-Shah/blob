"use client";

import { Camera, Search, Sparkles, Wand2 } from "lucide-react";
import { SignInButton } from "@/components/auth-buttons";
import { BLOB_ROLE } from "@/lib/roles";

type Props = {
  user?: {
    displayName?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;
};

const FEATURES = [
  {
    icon: Search,
    title: "Semantic",
    body: "Meaning-aware search beyond exact keywords.",
    tier: "user",
  },
  {
    icon: Wand2,
    title: "Hybrid",
    body: "Keywords + embeddings for sharper ranking.",
    tier: "member",
  },
  {
    icon: Camera,
    title: "Image",
    body: "Drop or paste a pic — find lookalikes.",
    tier: "member",
  },
  {
    icon: Sparkles,
    title: "Agent",
    body: "An agent plans the query, then runs it.",
    tier: "member",
  },
] as const;

export function SearchUpsell({ user }: Props) {
  const isGuest = !user;
  const isSpectator = user?.role === BLOB_ROLE.user;

  if (!isGuest && !isSpectator) return null;

  return (
    <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-divider bg-surface px-6 py-10 sm:px-12 sm:py-14">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-[46%_54%_38%_62%/58%_39%_61%_42%] bg-accent-gradient opacity-15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-[62%_38%_54%_46%/42%_58%_39%_61%] bg-accent-gradient opacity-10 blur-2xl" />

        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-accent-pink">
          search unlocks
        </p>
        <h2 className="zune-header mt-2 max-w-xl text-3xl font-light lowercase tracking-tight text-primary sm:text-4xl">
          {isGuest
            ? "register for smarter search"
            : "go member for the full toolkit"}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-secondary">
          {isGuest
            ? "Guests get keyword search. Create an account for semantic search — members unlock hybrid, image, and agent."
            : "You’re signed in with keyword + semantic. Ask an admin for member to unlock hybrid, image, and agent search."}
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            const locked =
              isGuest || (isSpectator && f.tier === "member");
            return (
              <li
                key={f.title}
                className={`rounded-[1.75rem] border border-divider bg-background/60 p-5 ${
                  locked ? "opacity-90" : ""
                }`}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-gradient text-white">
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="mt-3 text-sm font-semibold text-primary">
                  {f.title}
                  {f.tier === "member" ? (
                    <span className="ml-2 text-[0.65rem] font-bold uppercase tracking-wider text-accent-orange">
                      member
                    </span>
                  ) : isGuest ? (
                    <span className="ml-2 text-[0.65rem] font-bold uppercase tracking-wider text-accent-pink">
                      account
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs leading-5 text-secondary">{f.body}</p>
              </li>
            );
          })}
        </ul>

        {isGuest ? (
          <div className="mt-8">
            <SignInButton />
          </div>
        ) : null}
      </div>
    </section>
  );
}
