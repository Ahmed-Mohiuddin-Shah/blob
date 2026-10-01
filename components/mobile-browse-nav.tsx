"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Images,
  Library,
  Printer,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const LINKS: { href: string; label: string; icon: LucideIcon; match: string }[] =
  [
    { href: "/stickers", label: "Stickers", icon: Images, match: "/stickers" },
    { href: "/blobbers", label: "Blobbers", icon: Sparkles, match: "/blobbers" },
    { href: "/prints", label: "Prints", icon: Printer, match: "/prints" },
    {
      href: "/collections",
      label: "Collections",
      icon: Library,
      match: "/collections",
    },
    { href: "/search", label: "Search", icon: Search, match: "/search" },
  ];

/** Persistent bottom section nav for compact widths. */
export function MobileBrowseNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      aria-label="Browse"
    >
      <ul className="mx-auto flex max-w-7xl items-stretch justify-around px-1">
        {LINKS.map(({ href, label, icon: Icon, match }) => {
          const active = pathname.startsWith(match);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-semibold ${
                  active ? "text-foreground" : "text-inactive"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-accent-pink" : ""}`}
                  strokeWidth={1.75}
                  aria-hidden
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
