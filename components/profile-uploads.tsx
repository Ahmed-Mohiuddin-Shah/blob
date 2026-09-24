"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BusyButton } from "./busy-button";

export type UploadRow = {
  id: string;
  title: string;
  size: number;
  status: string;
  createdAt: string;
};

export function ProfileUploads({
  canUpload,
  uploads,
}: {
  canUpload: boolean;
  uploads: UploadRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/profile/uploads", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || `Upload failed (${res.status})`);
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  return (
    <div className="mt-12 border-t border-divider pt-8 text-left">
      <h2 className="text-lg font-semibold tracking-tight">Glass uploads</h2>
      <p className="mt-1 text-sm text-secondary">
        Files go to your private GLASS prism. An admin can approve them onto the
        public prism.
      </p>

      {canUpload ? (
        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block flex-1 text-sm">
            <span className="text-secondary">File</span>
            <input
              type="file"
              name="file"
              required
              className="mt-1 block w-full text-sm"
            />
          </label>
          <BusyButton
            type="submit"
            busy={pending}
            className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-105"
          >
            Upload
          </BusyButton>
        </form>
      ) : (
        <p className="mt-4 text-sm text-secondary">
          Upload requires an active <span className="font-medium">member</span>{" "}
          (or admin) role.
        </p>
      )}

      {error ? (
        <p className="mt-3 text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-6 space-y-3">
        {uploads.length === 0 ? (
          <li className="text-sm text-secondary">No uploads yet.</li>
        ) : (
          uploads.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{u.title}</p>
                <p className="text-xs text-secondary">
                  {u.status} · {(u.size / 1024).toFixed(1)} KiB ·{" "}
                  {new Date(u.createdAt).toLocaleString()}
                </p>
              </div>
              <a
                href={`/api/profile/uploads/${u.id}/file`}
                className="shrink-0 font-semibold text-accent-pink hover:underline"
              >
                View
              </a>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
