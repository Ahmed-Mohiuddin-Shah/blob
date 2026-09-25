"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "/stickers", label: "Stickers" },
  { href: "/prints", label: "Prints" },
  { href: "/collections", label: "Collections" },
] as const;

function linkClass(active: boolean) {
  return active
    ? "text-foreground"
    : "text-inactive transition-colors hover:text-foreground";
}

export function HeaderNavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
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

      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-divider bg-surface text-foreground sm:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        ) : (
          <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        )}
      </button>

      {open ? (
        <div
          id="mobile-nav"
          className="absolute left-0 right-0 top-full z-50 border-b border-divider bg-background/95 px-5 py-4 shadow-lg backdrop-blur-md sm:hidden"
        >
          <nav className="mx-auto flex max-w-7xl flex-col gap-1">
            {LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                  pathname.startsWith(href)
                    ? "bg-surface text-foreground"
                    : "text-secondary hover:bg-surface/60 hover:text-foreground"
                }`}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}
