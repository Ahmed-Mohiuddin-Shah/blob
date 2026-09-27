"use client";

import Link from "next/link";

export type BlobberEditItem = {
  id: string;
  status: string;
  createdAt: string;
  blobber: { id: string; displayName: string };
  requester: { username: string; displayName: string };
};

export function BlobberEditRequestsList({ items }: { items: BlobberEditItem[] }) {
  const pending = items.filter((i) => i.status === "pending");

  if (pending.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-secondary">No pending edits.</p>
    );
  }

  return (
    <ul className="space-y-3">
      {pending.map((item) => (
        <li key={item.id}>
          <Link
            href={`/profile/blobber-edits/${item.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-divider bg-surface px-4 py-4 transition hover:border-accent-pink/40"
          >
            <div>
              <p className="font-semibold text-accent-pink">
                {item.blobber.displayName}
              </p>
              <p className="text-xs text-secondary">
                by {item.requester.displayName || item.requester.username}
              </p>
            </div>
            <div className="text-right">
              <time className="block text-[10px] text-inactive">
                {new Date(item.createdAt).toLocaleString()}
              </time>
              <span className="text-xs font-semibold text-secondary">
                Open preview →
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
