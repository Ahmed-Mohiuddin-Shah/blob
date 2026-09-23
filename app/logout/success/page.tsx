import Link from "next/link";

export default function LogoutSuccessPage() {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Signed out</h1>
      <p className="mt-2 text-sm text-secondary">
        You have been signed out of BLOB and Zitadel.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform duration-200 hover:scale-105"
      >
        Back to home
      </Link>
    </div>
  );
}
