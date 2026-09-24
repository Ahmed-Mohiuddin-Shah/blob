"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyButton } from "./busy-button";
import { StickerMedia } from "./sticker-media";

export type ModerationItem = {
  id: string;
  title: string;
  slug: string;
  author: string;
  type: string;
  status: string;
  processingStatus: string;
  thumbUrl: string;
  createdAt: string;
  moderationNote?: string | null;
};

export function StickerModerationList({
  items,
  canModerate,
}: {
  items: ModerationItem[];
  canModerate: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/stickers/${id}/${action}`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Action failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function requestEdit(id: string) {
    const trimmed = note.trim();
    if (!trimmed) {
      setError("Edit request needs a note");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/stickers/${id}/request-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Request edit failed");
        return;
      }
      setNoteFor(null);
      setNote("");
      router.refresh();
    } catch {
      setError("Request edit failed");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-secondary">Nothing pending.</p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-4 rounded-[1.5rem] border border-divider bg-surface p-4 sm:flex-row sm:items-center"
        >
          <a
            href={`/stickers/${item.slug}`}
            className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl"
          >
            <StickerMedia
              src={item.thumbUrl}
              seed={item.title}
              alt={item.title}
              video={item.type === "VIDEO"}
            />
          </a>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{item.title}</p>
            <p className="mt-0.5 text-xs text-secondary">
              by {item.author} · {item.type} · {item.status.replaceAll("_", " ")}
              {item.processingStatus !== "ready"
                ? ` · ${item.processingStatus}`
                : ""}
            </p>
            <p className="mt-0.5 text-xs text-inactive">
              {new Date(item.createdAt).toLocaleString()}
            </p>
            {item.moderationNote ? (
              <p className="mt-2 text-xs text-accent-orange">
                Note: {item.moderationNote}
              </p>
            ) : null}
            {noteFor === item.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="What should they change?"
                  className="w-full rounded-2xl border border-divider bg-background px-3 py-2 text-sm outline-none focus:border-accent-pink/50"
                />
                <div className="flex flex-wrap gap-2">
                  <BusyButton
                    type="button"
                    busy={busyId === item.id}
                    onClick={() => requestEdit(item.id)}
                    className="rounded-full bg-accent-gradient px-4 py-2 text-xs font-semibold text-white"
                  >
                    Send edit request
                  </BusyButton>
                  <button
                    type="button"
                    onClick={() => {
                      setNoteFor(null);
                      setNote("");
                    }}
                    className="rounded-full border border-divider px-4 py-2 text-xs font-semibold text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {canModerate ? (
            <div className="flex flex-wrap gap-2">
              <BusyButton
                type="button"
                busy={busyId === item.id}
                disabled={item.processingStatus !== "ready"}
                onClick={() => act(item.id, "approve")}
                className="rounded-full bg-accent-gradient px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Approve
              </BusyButton>
              <BusyButton
                type="button"
                busy={busyId === item.id}
                onClick={() => {
                  setNoteFor(item.id);
                  setNote("");
                  setError(null);
                }}
                className="rounded-full border border-divider bg-background px-4 py-2 text-xs font-semibold text-secondary"
              >
                Request edit
              </BusyButton>
              <Link
                href={`/stickers/${item.slug}/edit`}
                className="rounded-full border border-divider bg-background px-4 py-2 text-xs font-semibold text-secondary"
              >
                Edit
              </Link>
              <BusyButton
                type="button"
                busy={busyId === item.id}
                onClick={() => {
                  if (
                    !confirm(
                      "Reject and permanently delete this sticker from GLASS and the database?",
                    )
                  ) {
                    return;
                  }
                  void act(item.id, "reject");
                }}
                className="rounded-full border border-divider bg-background px-4 py-2 text-xs font-semibold text-accent-orange"
              >
                Reject
              </BusyButton>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
