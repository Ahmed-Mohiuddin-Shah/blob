import Link from "next/link";
import { Upload } from "lucide-react";
import { HeaderNavLinks } from "./header-nav-links";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { UserBlobatar } from "./user-blobatar";
import { SignInButton, SignOutButton } from "./auth-buttons";

export type SessionUser = {
  name?: string | null;
  username?: string | null;
  displayName?: string | null;
};

export function Header({
  user,
  canUpload = false,
  pendingApprovalCount = 0,
}: {
  user?: SessionUser | null;
  canUpload?: boolean;
  pendingApprovalCount?: number;
}) {
  const displayName = user?.displayName || user?.name || "User";
  const username = user?.username || "user";

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-md">
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <nav className="flex h-20 items-center justify-between gap-3">
          <Link href="/" className="group flex items-center gap-3" aria-label="BLOB home">
            <Logo
              size="sm"
              dot
              className="shadow-lg shadow-accent-pink/20 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105"
            />
            <span className="text-xl font-semibold tracking-tight">BLOB</span>
          </Link>

          <HeaderNavLinks />

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            {canUpload ? (
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-3 py-2 text-xs font-semibold text-white shadow-md shadow-accent-pink/20 transition-transform hover:scale-105 sm:px-4 sm:text-sm"
              >
                <Upload className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                <span className="hidden sm:inline">Upload</span>
              </Link>
            ) : null}

            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href="/profile"
                  className="relative flex items-center gap-3"
                  aria-label="Your profile"
                >
                  <span className="relative">
                    <UserBlobatar
                      username={username}
                      size={36}
                      className="overflow-hidden rounded-full ring-1 ring-divider"
                    />
                    {pendingApprovalCount > 0 ? (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-background"
                        title={`${pendingApprovalCount} items need attention`}
                        aria-label={`${pendingApprovalCount} items need attention`}
                      />
                    ) : null}
                  </span>
                  <span className="hidden max-w-[10rem] truncate text-sm font-semibold sm:block">
                    {displayName}
                  </span>
                </Link>
                <SignOutButton />
              </div>
            ) : (
              <SignInButton />
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
