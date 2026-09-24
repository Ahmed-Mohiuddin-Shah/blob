"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyButton } from "./busy-button";

type Props = {
  stickerId: string;
  signedIn: boolean;
  signInHref: string;
  defaults?: { contactName: string; contactEmail: string };
  alreadyPending?: boolean;
};

export function AttributionClaimForm({
  stickerId,
  signedIn,
  signInHref,
  defaults,
  alreadyPending,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!signedIn) {
    return (
      <p className="mt-6 text-sm">
        <Link href={signInHref} className="font-semibold text-accent-pink hover:underline">
          Sign in to claim attribution
        </Link>
      </p>
    );
  }

  if (alreadyPending) {
    return (
      <p className="mt-6 text-sm text-secondary">
        You have a pending attribution claim on this sticker.
      </p>
    );
  }

  if (done) {
    return (
      <p className="mt-6 text-sm text-secondary">
        Claim submitted — an admin will review it.
      </p>
    );
  }

  if (!open) {
    return (
      <p className="mt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-accent-pink hover:underline"
        >
          Claim attribution
        </button>
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      reason: String(fd.get("reason") ?? ""),
      contactName: String(fd.get("contactName") ?? ""),
      contactEmail: String(fd.get("contactEmail") ?? ""),
      proposedAuthorName: String(fd.get("proposedAuthorName") ?? ""),
      proposedSourceUrl: String(fd.get("proposedSourceUrl") ?? ""),
      message: String(fd.get("message") ?? ""),
    };
    try {
      const res = await fetch(`/api/stickers/${stickerId}/attribution-claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Submit failed");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 space-y-4 rounded-[1.5rem] border border-divider bg-surface p-4 text-sm"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-accent-pink">
        Claim attribution
      </p>
      <p className="text-xs text-secondary">
        Tell us this work is yours and how it should be credited. Source missing or
        mislabeled.
      </p>

      <label className="block">
        <span className="text-secondary">Reason</span>
        <select
          name="reason"
          required
          defaultValue="missing"
          className="mt-1 w-full rounded-2xl border border-divider bg-background px-4 py-2.5 outline-none"
        >
          <option value="missing">Attribution missing</option>
          <option value="mislabeled">Attribution mislabeled</option>
        </select>
      </label>

      <label className="block">
        <span className="text-secondary">Your name</span>
        <input
          name="contactName"
          required
          maxLength={200}
          defaultValue={defaults?.contactName ?? ""}
          className="mt-1 w-full rounded-2xl border border-divider bg-background px-4 py-2.5 outline-none"
        />
      </label>

      <label className="block">
        <span className="text-secondary">Contact email</span>
        <input
          name="contactEmail"
          type="email"
          required
          maxLength={255}
          defaultValue={defaults?.contactEmail ?? ""}
          className="mt-1 w-full rounded-2xl border border-divider bg-background px-4 py-2.5 outline-none"
        />
      </label>

      <label className="block">
        <span className="text-secondary">Correct attribution label</span>
        <input
          name="proposedAuthorName"
          required
          maxLength={200}
          className="mt-1 w-full rounded-2xl border border-divider bg-background px-4 py-2.5 outline-none"
        />
      </label>

      <label className="block">
        <span className="text-secondary">Correct source link</span>
        <input
          name="proposedSourceUrl"
          type="url"
          required
          maxLength={2048}
          placeholder="https://"
          className="mt-1 w-full rounded-2xl border border-divider bg-background px-4 py-2.5 outline-none"
        />
      </label>

      <label className="block">
        <span className="text-secondary">Message</span>
        <textarea
          name="message"
          required
          rows={3}
          placeholder="This is mine and I want my attribution…"
          className="mt-1 w-full rounded-2xl border border-divider bg-background px-4 py-2.5 outline-none"
        />
      </label>

      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <BusyButton
          type="submit"
          busy={busy}
          className="rounded-full bg-accent-gradient px-6 py-2.5 text-sm font-semibold text-white"
        >
          Submit claim
        </BusyButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-divider px-6 py-2.5 text-sm font-semibold text-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
