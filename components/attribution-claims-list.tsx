"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CLAIM_REASON,
  CLAIM_REASONS,
  CLAIM_STATUS,
  CLAIM_STATUSES,
} from "@/lib/attribution";
import { BusyButton } from "./busy-button";

export type AttributionClaimItem = {
  id: string;
  reason: string;
  status: string;
  contactName: string;
  contactEmail: string;
  message: string | null;
  proposedAuthorName: string;
  proposedSourceUrl: string;
  createdAt: string;
  sticker: { id: string; title: string; slug: string; thumbUrl: string };
  claimant: { username: string; displayName: string };
};

export function AttributionClaimsList({ items }: { items: AttributionClaimItem[] }) {
  const router = useRouter();
  const [reasonFacet, setReasonFacet] = useState("");
  const [statusFacet, setStatusFacet] = useState<string>(CLAIM_STATUS.pending);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [action, setAction] = useState<"approve" | "reject">("approve");

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (reasonFacet && i.reason !== reasonFacet) return false;
      if (statusFacet && i.status !== statusFacet) return false;
      return true;
    });
  }, [items, reasonFacet, statusFacet]);

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
      const res = await fetch(`/api/attribution-claims/${noteFor}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Action failed");
        return;
      }
      setNoteFor(null);
      setNote("");
      router.refresh();
    } catch {
      setError("Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { value: "", label: "All reasons" },
          ...CLAIM_REASONS.map((r) => ({
            value: r,
            label: r === CLAIM_REASON.missing ? "Missing" : "Mislabeled",
          })),
        ].map((f) => (
          <button
            key={`r-${f.value || "all"}`}
            type="button"
            onClick={() => setReasonFacet(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              reasonFacet === f.value
                ? "bg-accent-gradient text-white"
                : "border border-divider bg-surface text-secondary hover:border-accent-pink/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          ...CLAIM_STATUSES.map((s) => ({
            value: s,
            label: s[0]!.toUpperCase() + s.slice(1),
          })),
          { value: "", label: "All status" },
        ].map((f) => (
          <button
            key={`s-${f.value || "all"}`}
            type="button"
            onClick={() => setStatusFacet(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              statusFacet === f.value
                ? "bg-accent-gradient text-white"
                : "border border-divider bg-surface text-secondary hover:border-accent-pink/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-secondary">No claims.</p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((item) => (
            <li
              key={item.id}
              className="rounded-[1.5rem] border border-divider bg-surface p-4 text-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <Link
                  href={`/stickers/${item.sticker.slug}`}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-divider"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.sticker.thumbUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    <Link
                      href={`/stickers/${item.sticker.slug}`}
                      className="hover:text-accent-pink"
                    >
                      {item.sticker.title}
                    </Link>
                    <span className="ml-2 text-xs font-bold uppercase tracking-wider text-accent-pink">
                      {item.reason}
                    </span>
                    <span className="ml-2 text-xs text-inactive">
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    Claimant: {item.claimant.displayName || item.claimant.username} ·{" "}
                    {item.contactName} &lt;{item.contactEmail}&gt;
                  </p>
                  <p className="mt-2 text-xs">
                    Proposed:{" "}
                    <a
                      href={item.proposedSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent-pink hover:underline"
                    >
                      {item.proposedAuthorName}
                    </a>
                  </p>
                  {item.message ? (
                    <p className="mt-2 text-xs text-secondary">{item.message}</p>
                  ) : null}
                  <time className="mt-2 block text-[10px] text-inactive">
                    {new Date(item.createdAt).toLocaleString()}
                  </time>

                  {item.status === "pending" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <BusyButton
                        type="button"
                        busy={busyId === item.id}
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
                        busy={busyId === item.id}
                        disabled={!!busyId}
                        onClick={() => {
                          setNoteFor(item.id);
                          setAction("reject");
                          setNote("");
                        }}
                        className="rounded-full border border-divider bg-background px-4 py-2 text-xs font-semibold text-accent-orange"
                      >
                        Reject
                      </BusyButton>
                    </div>
                  ) : null}

                  {noteFor === item.id ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        placeholder="Admin note (required)"
                        className="w-full rounded-2xl border border-divider bg-background px-3 py-2 text-xs outline-none"
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
                          className="rounded-full border border-divider px-4 py-2 text-xs font-semibold text-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
