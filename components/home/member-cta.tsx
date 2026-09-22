import { Logo } from "../logo";
import { SignInButton } from "../auth-buttons";

type Props = {
  user?: { displayName?: string | null; name?: string | null; role?: string | null } | null;
};

export function MemberCta({ user }: Props) {
  const displayName = user?.displayName || user?.name;

  return (
    <section className="mx-auto max-w-7xl px-5 pb-28 sm:px-8">
      <div className="relative overflow-hidden rounded-[3rem] border border-divider bg-surface px-6 py-12 text-center sm:px-12">
        <Logo className="mx-auto" />

        {user ? (
          <>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">You’re in, {displayName}.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-secondary">
              {user.role === "user"
                ? "Browse, search, and save stickers. An admin can promote you to member when you’re ready to upload."
                : "Contribute stickers, build packs, and keep the library sticky."}
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
              Have something worth sticking around for?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-secondary">
              Sign in with your Zitadel account to join BLOB. New members are approved manually before they can upload.
            </p>
            <SignInButton className="mt-7 inline-flex" />
          </>
        )}
      </div>
    </section>
  );
}
