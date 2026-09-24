import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-divider">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-2">
          <Logo size="xs" />
          <span>BLOB</span>
        </div>

        <div className="flex flex-wrap gap-5">
          <Link href="/about" className="transition-colors hover:text-foreground">
            About
          </Link>
          <Link href="/stickers" className="transition-colors hover:text-foreground">
            Stickers
          </Link>
          <Link href="/prints" className="transition-colors hover:text-foreground">
            Prints
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
        </div>

        <p className="text-xs text-inactive">Made of pixels and questionable decisions.</p>
      </div>
    </footer>
  );
}
