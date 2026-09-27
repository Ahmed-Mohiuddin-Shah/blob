"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyButton } from "./busy-button";

export function BlobberEditReviewActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject" | "request-edit") {
    const trimmed = note.trim();
    if (!trimmed) {
      setError("Admin note required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/blobber-edit-requests/${requestId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: trimmed }),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      router.push("/profile/blobber-edits");
      router.refresh();
    } catch {
      setError("Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-divider bg-surface p-4">
      <label className="block text-sm">
        <span className="text-secondary">Admin note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-2xl border border-divider bg-background px-4 py-2.5 outline-none"
          placeholder="Required for approve / reject / request edit"
        />
      </label>
      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <BusyButton
          type="button"
          busy={busy}
          disabled={busy}
          onClick={() => void act("approve")}
          className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
        >
          Approve
        </BusyButton>
        <BusyButton
          type="button"
          busy={busy}
          disabled={busy}
          onClick={() => void act("request-edit")}
          className="rounded-full border border-divider px-5 py-2.5 text-sm font-semibold"
        >
          Request edit
        </BusyButton>
        <BusyButton
          type="button"
          busy={busy}
          disabled={busy}
          onClick={() => void act("reject")}
          className="rounded-full border border-accent-orange/40 px-5 py-2.5 text-sm font-semibold text-accent-orange"
        >
          Reject
        </BusyButton>
      </div>
    </div>
  );
}
