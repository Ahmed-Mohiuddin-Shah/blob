"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { blobberPublicHref } from "@/lib/blobbers";
import { BusyButton } from "./busy-button";

export type AssocItem = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  targetBlobber: { id: string; displayName: string; slug: string };
  requester: { username: string; displayName: string };
};

export function BlobberAssociationRequestsList({
  items,
}: {
  items: AssocItem[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [action, setAction] = useState<"approve" | "reject">("approve");

  async function decide() {
    if (!noteFor) return;
    const trimmed = note.trim();
    if (!trimmed) {
      setError("Admin note required");
      return;
    }
    setBusyId(noteFor);
    setError(null);
    try {
      const res = await fetch(
        `/api/blobber-association-requests/${noteFor}/${action}`,
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
      setNoteFor(null);
      router.refresh();
    } catch {
      setError("Failed");
    } finally {
      setBusyId(null);
    }
  }

  const pending = items.filter((i) => i.status === "pending");

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      {pending.length === 0 ? (
        <p className="py-10 text-center text-sm text-secondary">
          No pending associations.
        </p>
      ) : (
        pending.map((item) => (
          <article
            key={item.id}
            className="rounded-[1.5rem] border border-divider bg-surface p-4"
          >
            <p className="text-sm font-semibold">
              {item.requester.displayName || item.requester.username} →{" "}
              <Link
                href={blobberPublicHref(item.targetBlobber)}
                className="text-accent-pink hover:underline"
              >
                {item.targetBlobber.displayName}
              </Link>
            </p>
            {item.message ? (
              <p className="mt-2 text-xs text-secondary">{item.message}</p>
            ) : null}
            <time className="mt-2 block text-[10px] text-inactive">
              {new Date(item.createdAt).toLocaleString()}
            </time>

            {noteFor === item.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Admin note (required)"
                  className="w-full rounded-2xl border border-divider bg-background px-4 py-2.5 text-sm outline-none"
                />
                <div className="flex gap-2">
                  <BusyButton
                    type="button"
                    busy={busyId === item.id}
                    onClick={() => void decide()}
                    className="rounded-full bg-accent-gradient px-4 py-2 text-xs font-semibold text-white"
                  >
                    Confirm {action}
                  </BusyButton>
                  <button
                    type="button"
                    onClick={() => setNoteFor(null)}
                    className="rounded-full border border-divider px-4 py-2 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <BusyButton
                  type="button"
                  busy={!!busyId}
                  disabled={!!busyId}
                  onClick={() => {
                    setNoteFor(item.id);
                    setAction("approve");
                    setNote("");
                  }}
                  className="rounded-full bg-accent-gradient px-4 py-2 text-xs font-semibold text-white"
                >
                  Approve
                </BusyButton>
                <BusyButton
                  type="button"
                  busy={!!busyId}
                  disabled={!!busyId}
                  onClick={() => {
                    setNoteFor(item.id);
                    setAction("reject");
                    setNote("");
                  }}
                  className="rounded-full border border-accent-orange/40 px-4 py-2 text-xs font-semibold text-accent-orange"
                >
                  Reject
                </BusyButton>
              </div>
            )}
          </article>
        ))
      )}
    </div>
  );
}
