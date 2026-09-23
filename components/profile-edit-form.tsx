"use client";

import { useActionState } from "react";
import {
  updateProfile,
  type ProfileActionState,
} from "@/app/actions/profile";

const initial: ProfileActionState = {};

export function ProfileEditForm({
  displayName,
  email,
  username,
}: {
  displayName: string;
  email: string;
  username: string;
}) {
  const [state, action, pending] = useActionState(updateProfile, initial);

  return (
    <form action={action} className="mt-10 space-y-4 border-t border-divider pt-8 text-left text-sm">
      <label className="block">
        <span className="text-secondary">Display name</span>
        <input
          name="displayName"
          defaultValue={displayName}
          required
          maxLength={100}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none focus:border-accent-pink"
        />
      </label>
      <label className="block">
        <span className="text-secondary">Email</span>
        <input
          name="email"
          type="email"
          defaultValue={email}
          required
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none focus:border-accent-pink"
        />
      </label>
      <label className="block">
        <span className="text-secondary">Username</span>
        <input
          name="username"
          defaultValue={username}
          required
          pattern="[a-zA-Z0-9_]+"
          maxLength={50}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none focus:border-accent-pink"
        />
        <span className="mt-1 block text-xs text-secondary">
          Local handle for your blobatar. Letters, numbers, underscore.
        </span>
      </label>

      {state.error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-secondary" role="status">
          Saved. Sign out and back in if your session still shows the old name.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent-gradient px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-105 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
