"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BusyButton } from "./busy-button";

function Form() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stickerId = searchParams.get("stickerId");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          tags,
          ...(stickerId ? { stickerId } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not create");
        return;
      }
      router.push(`/collections/${json.slug}`);
    } catch {
      setError("Could not create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-lg space-y-5">
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-inactive">
          Name
        </label>
        <input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 w-full rounded-2xl border border-divider bg-surface px-4 py-3 text-sm outline-none focus:border-accent-pink/50"
          placeholder="Globally unique name"
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-inactive">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-2xl border border-divider bg-surface px-4 py-3 text-sm outline-none focus:border-accent-pink/50"
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-inactive">
          Tags
        </label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="mt-1.5 w-full rounded-2xl border border-divider bg-surface px-4 py-3 text-sm outline-none focus:border-accent-pink/50"
          placeholder="comma, separated"
        />
      </div>
      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      <BusyButton
        type="submit"
        busy={busy}
        className="rounded-full bg-accent-gradient px-6 py-3 text-sm font-semibold text-white"
      >
        Create collection
      </BusyButton>
    </form>
  );
}

export function NewCollectionClient() {
  return (
    <Suspense fallback={<p className="text-sm text-secondary">Loading…</p>}>
      <Form />
    </Suspense>
  );
}
