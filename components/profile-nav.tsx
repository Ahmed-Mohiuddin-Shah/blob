"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  Flag,
  Heart,
  History,
  ImageIcon,
  LayoutDashboard,
  Link2,
  Pencil,
  Printer,
  ScrollText,
  Server,
  Settings,
  Sparkles,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";

type Props = {
  canUpload: boolean;
  isAdmin: boolean;
  isSuperadmin: boolean;
  pendingCount: number;
  needsEditCount: number;
  claimsCount: number;
  blobberEditsCount: number;
  blobberAssocCount: number;
  username: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: (pathname: string) => boolean;
  badge?: number;
  admin?: boolean;
  superadmin?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const linkClass = (active: boolean) =>
  `flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition-colors ${
    active
      ? "bg-surface text-foreground shadow-sm ring-1 ring-divider"
      : "text-secondary hover:bg-surface/60 hover:text-foreground"
  }`;

export function ProfileNav({
  canUpload,
  isAdmin,
  isSuperadmin,
  pendingCount,
  needsEditCount,
  claimsCount,
  blobberEditsCount,
  blobberAssocCount,
  username,
}: Props) {
  const pathname = usePathname();

  const sections: NavSection[] = [
    {
      title: "Library",
      items: [
        {
          href: "/profile",
          label: "Overview",
          icon: LayoutDashboard,
          active: (p) => p === "/profile",
        },
        {
          href: "/profile/uploads",
          label: "Uploads",
          icon: ImageIcon,
          active: (p) => p.startsWith("/profile/uploads"),
        },
        {
          href: "/profile/favourites",
          label: "Favourites",
          icon: Heart,
          active: (p) => p.startsWith("/profile/favourites"),
        },
        {
          href: "/profile/prints",
          label: "Prints",
          icon: Printer,
          active: (p) => p.startsWith("/profile/prints"),
        },
      ],
    },
    {
      title: "Moderation",
      items: [
        {
          href: "/profile/pending",
          label: "Pending",
          icon: Clock,
          active: (p) => p.startsWith("/profile/pending"),
          badge: pendingCount,
        },
        {
          href: "/profile/edits",
          label: "Edits",
          icon: Pencil,
          active: (p) => p.startsWith("/profile/edits"),
          badge: needsEditCount,
        },
        {
          href: "/profile/claims",
          label: "Claims",
          icon: Flag,
          active: (p) => p.startsWith("/profile/claims"),
          badge: claimsCount,
          admin: true,
        },
        {
          href: "/profile/blobber-edits",
          label: "Blobber edits",
          icon: Pencil,
          active: (p) => p.startsWith("/profile/blobber-edits"),
          badge: blobberEditsCount,
          admin: true,
        },
      ],
    },
    {
      title: "Blobber",
      items: [
        {
          href: "/profile/blobber",
          label: "Blobber",
          icon: Sparkles,
          active: (p) =>
            p === "/profile/blobber" || p.startsWith("/profile/blobber/"),
        },
        {
          href: "/profile/blobber-associations",
          label: "Associations",
          icon: Link2,
          active: (p) => p.startsWith("/profile/blobber-associations"),
          badge: blobberAssocCount,
          admin: true,
        },
        {
          href: "/profile/unlinked-blobbers",
          label: "Unlinked",
          icon: Users,
          active: (p) => p.startsWith("/profile/unlinked-blobbers"),
          admin: true,
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          href: "/profile/settings",
          label: "Settings",
          icon: Settings,
          active: (p) => p.startsWith("/profile/settings"),
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          href: "/profile/history",
          label: "History",
          icon: History,
          active: (p) => p.startsWith("/profile/history"),
          admin: true,
        },
        {
          href: "/profile/workers",
          label: "Workers",
          icon: Server,
          active: (p) => p.startsWith("/profile/workers"),
          admin: true,
        },
        {
          href: "/profile/logs",
          label: "Logs",
          icon: ScrollText,
          active: (p) => p.startsWith("/profile/logs"),
          superadmin: true,
        },
        {
          href: "/profile/users",
          label: "Manage users",
          icon: Users,
          active: (p) => p.startsWith("/profile/users"),
          admin: true,
        },
      ],
    },
  ];

  return (
    <aside className="w-full shrink-0 sm:w-56">
      <p className="mb-3 truncate px-3 text-xs font-bold uppercase tracking-wider text-inactive">
        @{username}
      </p>
      <nav className="flex flex-row gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
        {sections.map((section) => {
          const items = section.items.filter((item) => {
            if (item.superadmin) return isSuperadmin;
            if (item.admin) return isAdmin;
            return true;
          });
          if (!items.length) return null;
          return (
            <div
              key={section.title}
              className="flex flex-row gap-1 sm:mb-3 sm:flex-col sm:gap-1"
            >
              <p className="mb-1 hidden px-3 text-[0.65rem] font-bold uppercase tracking-wider text-inactive sm:block">
                {section.title}
              </p>
              {items.map((item) => {
                const Icon = item.icon;
                const active = item.active(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={linkClass(active)}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    {item.label}
                    {item.badge && item.badge > 0 ? (
                      <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
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
