"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BlobberCombobox, type BlobberPick } from "./blobber-combobox";
import { BusyButton } from "./busy-button";

export function BlobberAssociateForm() {
  const router = useRouter();
  const [blobber, setBlobber] = useState<BlobberPick | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!blobber?.id) {
      setError("Select an existing Blobber (search and pick)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/blobber-association-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetBlobberId: blobber.id,
          message,
        }),
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

  if (done) {
    return (
      <p className="text-sm text-secondary">
        Association request submitted — an admin will review it.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-5 text-sm">
      <p className="text-xs text-secondary">
        Request to link your account to an existing unlinked Blobber (e.g. your
        name on another platform). Your default Blobber row is kept; stickers
        attributed to it move to the claimed profile on approve.
      </p>
      <label className="block">
        <span className="text-secondary">Target Blobber</span>
        <BlobberCombobox
          value={blobber}
          onChange={setBlobber}
          allowCreate={false}
        />
      </label>
      <label className="block">
        <span className="text-secondary">Message</span>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none"
          placeholder="Why this Blobber is you…"
        />
      </label>
      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      <BusyButton
        type="submit"
        busy={busy}
        className="rounded-full bg-accent-gradient px-8 py-3 text-sm font-semibold text-white"
      >
        Submit request
      </BusyButton>
    </form>
  );
}
