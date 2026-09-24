"use client";

import { useActionState } from "react";
import {
  updateUsername,
  type ProfileActionState,
} from "@/app/actions/profile";
import { BusyButton } from "./busy-button";

const initial: ProfileActionState = {};

export function ProfileEditForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState(updateUsername, initial);

  return (
    <form action={action} className="mt-6 max-w-md space-y-4 text-left text-sm">
      <label className="block">
        <span className="text-secondary">Username</span>
        <input
          name="username"
          defaultValue={username}
          required
          pattern="[a-zA-Z0-9_]+"
          maxLength={50}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
        />
        <span className="mt-1 block text-xs text-secondary">
          Local handle for your blobatar. Letters, numbers, underscore. Display
          name and email come from your identity provider and can&apos;t be
          edited here.
        </span>
      </label>

      {state.error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-secondary" role="status">
          Saved.
        </p>
      ) : null}

      <BusyButton
        type="submit"
        busy={pending}
        className="rounded-full bg-accent-gradient px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-105"
      >
        Save username
      </BusyButton>
    </form>
  );
}
