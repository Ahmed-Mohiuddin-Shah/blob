"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  ImageIcon,
  LayoutDashboard,
  Settings,
  Upload,
  Users,
} from "lucide-react";

type Props = {
  canUpload: boolean;
  isAdmin: boolean;
  pendingCount: number;
  username: string;
};

const linkClass = (active: boolean) =>
  `flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition-colors ${
    active
      ? "bg-surface text-foreground shadow-sm ring-1 ring-divider"
      : "text-secondary hover:bg-surface/60 hover:text-foreground"
  }`;

export function ProfileNav({ canUpload, isAdmin, pendingCount, username }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 sm:w-56">
      <p className="mb-3 truncate px-3 text-xs font-bold uppercase tracking-wider text-inactive">
        @{username}
      </p>
      <nav className="flex flex-row gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
        <Link href="/profile" className={linkClass(pathname === "/profile")}>
          <LayoutDashboard className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Overview
        </Link>
        <Link
          href="/profile/uploads"
          className={linkClass(pathname.startsWith("/profile/uploads"))}
        >
          <ImageIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Uploads
        </Link>
        <Link
          href="/profile/pending"
          className={linkClass(pathname.startsWith("/profile/pending"))}
        >
          <Clock className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Pending
          {pendingCount > 0 ? (
            <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {pendingCount}
            </span>
          ) : null}
        </Link>
        <Link
          href="/profile/settings"
          className={linkClass(pathname.startsWith("/profile/settings"))}
        >
          <Settings className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Settings
        </Link>
        {isAdmin ? (
          <Link
            href="/admin/users"
            className={linkClass(pathname.startsWith("/admin/users"))}
          >
            <Users className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Manage users
          </Link>
        ) : null}
      </nav>

      {canUpload ? (
        <Link
          href="/upload"
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-accent-pink/20 transition-transform hover:scale-[1.02]"
        >
          <Upload className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Upload sticker
        </Link>
      ) : null}
    </aside>
  );
}
