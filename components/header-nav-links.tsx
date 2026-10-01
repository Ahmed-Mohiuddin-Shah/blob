"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/stickers", label: "Stickers" },
  { href: "/blobbers", label: "Blobbers" },
  { href: "/prints", label: "Prints" },
  { href: "/collections", label: "Collections" },
] as const;

function linkClass(active: boolean) {
  return active
    ? "text-foreground"
    : "text-inactive transition-colors hover:text-foreground";
}

/** Desktop header links only — mobile uses MobileBrowseNav. */
export function HeaderNavLinks() {
  const pathname = usePathname();

  return (
    <div className="hidden items-center gap-8 text-sm font-semibold sm:flex">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={linkClass(pathname.startsWith(href))}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
