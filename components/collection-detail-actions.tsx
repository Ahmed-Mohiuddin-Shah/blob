"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyButton } from "./busy-button";

type Props = {
  slug: string;
  name: string;
  description: string;
  tags: string;
};

export function CollectionDetailActions({
  slug,
  name: initialName,
  description: initialDescription,
  tags: initialTags,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [tags, setTags] = useState(initialTags);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/collections/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, tags }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not save");
        return;
      }
      setEditing(false);
      if (json.slug && json.slug !== slug) {
        router.replace(`/collections/${json.slug}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center rounded-full border border-divider bg-surface px-5 py-2.5 text-sm font-semibold hover:border-accent-pink/40"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-[1.5rem] border border-divider bg-surface p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        className="w-full rounded-2xl border border-divider bg-background px-4 py-2.5 text-sm outline-none focus:border-accent-pink/50"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full rounded-2xl border border-divider bg-background px-4 py-2.5 text-sm outline-none focus:border-accent-pink/50"
      />
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="tags"
        className="w-full rounded-2xl border border-divider bg-background px-4 py-2.5 text-sm outline-none focus:border-accent-pink/50"
      />
      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <BusyButton
          type="button"
          busy={busy}
          onClick={() => void save()}
          className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
        >
          Save
        </BusyButton>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-full border border-divider px-5 py-2.5 text-sm font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
