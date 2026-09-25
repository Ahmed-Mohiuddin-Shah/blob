"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyButton } from "./busy-button";

type Props = {
  kind: "sheets" | "packs";
  id: string;
  /** Where to go after a successful delete */
  afterDeleteHref?: string;
};

/** Retry / delete controls — only mount when status is failed. */
export function PrintFailedActions({
  kind,
  id,
  afterDeleteHref = "/profile/prints",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"retry" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy("retry");
    setError(null);
    try {
      const res = await fetch(`/api/${kind}/${id}`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Retry failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        "Delete this failed print? This cannot be undone.",
      )
    ) {
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/${kind}/${id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not delete");
        return;
      }
      router.push(afterDeleteHref);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-orange">
        Encode failed
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <BusyButton
          type="button"
          busy={busy === "retry"}
          disabled={busy !== null}
          onClick={() => void retry()}
          className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
        >
          Retry
        </BusyButton>
        <BusyButton
          type="button"
          busy={busy === "delete"}
          disabled={busy !== null}
          onClick={() => void remove()}
          className="rounded-full border border-divider px-5 py-2.5 text-sm font-semibold text-secondary hover:border-accent-orange/50 hover:text-accent-orange"
        >
          Delete
        </BusyButton>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
