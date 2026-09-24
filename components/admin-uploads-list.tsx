"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BusyButton } from "./busy-button";

export type PendingUpload = {
  id: string;
  title: string;
  size: number;
  status: string;
  username: string;
  createdAt: string;
};

export function AdminUploadsList({ uploads }: { uploads: PendingUpload[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function approve(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/uploads/${id}/approve`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || `Approve failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  if (uploads.length === 0) {
    return <p className="text-sm text-secondary">No pending uploads.</p>;
  }

  return (
    <div>
      {error ? (
        <p className="mb-4 text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-divider">
        {uploads.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium">{u.title}</p>
              <p className="text-xs text-secondary">
                @{u.username} · {u.status} · {(u.size / 1024).toFixed(1)} KiB
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`/api/profile/uploads/${u.id}/file`}
                className="font-semibold text-accent-pink hover:underline"
              >
                View
              </a>
              {u.status === "pending" ? (
                <BusyButton
                  type="button"
                  busy={pending}
                  onClick={() => approve(u.id)}
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-105"
                >
                  Approve
                </BusyButton>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
