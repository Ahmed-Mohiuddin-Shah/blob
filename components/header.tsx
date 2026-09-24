import Link from "next/link";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { UserBlobatar } from "./user-blobatar";
import { SignInButton, SignOutButton } from "./auth-buttons";

export type SessionUser = {
  name?: string | null;
  username?: string | null;
  displayName?: string | null;
};

export function Header({ user }: { user?: SessionUser | null }) {
  const displayName = user?.displayName || user?.name || "User";
  const username = user?.username || "user";

  return (
    <header className="mx-auto w-full max-w-7xl px-5 sm:px-8">
      <nav className="flex h-20 items-center justify-between">
        <Link href="/" className="group flex items-center gap-3" aria-label="BLOB home">
          <Logo
            size="sm"
            dot
            className="shadow-lg shadow-accent-pink/20 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105"
          />
          <span className="text-xl font-semibold tracking-tight">BLOB</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-semibold sm:flex">
          <Link href="/stickers" className="text-inactive transition-colors hover:text-foreground">
            Stickers
          </Link>
          <Link href="/prints" className="text-inactive transition-colors hover:text-foreground">
            Prints
          </Link>
          <Link href="/collections" className="text-inactive transition-colors hover:text-foreground">
            Collections
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/profile" className="flex items-center gap-3" aria-label="Your profile">
                <UserBlobatar username={username} size={36} className="overflow-hidden rounded-full ring-1 ring-divider" />
                <span className="hidden max-w-[10rem] truncate text-sm font-semibold sm:block">{displayName}</span>
              </Link>
              <SignOutButton />
            </div>
          ) : (
            <SignInButton />
          )}
        </div>
      </nav>
    </header>
  );
}
