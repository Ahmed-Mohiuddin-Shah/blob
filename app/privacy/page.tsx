import Link from "next/link";

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-wider text-inactive">
        Legal
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        Privacy policy
      </h1>
      <p className="mt-2 text-sm text-secondary">Last updated: 24 Sep 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-secondary">
        <section>
          <h2 className="text-base font-semibold text-foreground">
            What we store
          </h2>
          <p className="mt-2">
            Sign-in uses Zitadel. We keep account details such as email, display
            name, and a local username, role, and account status. Stickers,
            metadata, and media references live in our database; binary files
            live in GLASS object storage. Profile pictures are generated from
            your username via blobatar — we do not use identity-provider photos.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Human moderation (not bots)
          </h2>
          <p className="mt-2">
            Content review is <strong className="text-foreground">manual</strong>.
            There is no automated system scanning uploads for approval. Human
            admins review submissions so the library stays clean and is not
            flooded with junk.
          </p>
          <p className="mt-2">
            Admins can see pending and edit-requested uploads — including
            private and unlisted ones — for that purpose only. After a private
            sticker is approved, admins can no longer open its page or media;
            only you can. Unlisted approved stickers remain available to anyone
            who has the link. Moderation history may still keep titles, notes,
            and actions even after media is gone or private.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            How we use data
          </h2>
          <p className="mt-2">
            We use account and content data to run BLOB: auth, library browse,
            uploads, moderation, and prints. We do not sell your personal data.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Questions</h2>
          <p className="mt-2">
            For privacy questions, contact a BLOB admin through the channels
            published for this instance. Related:{" "}
            <Link href="/terms" className="font-semibold text-accent-pink hover:underline">
              Terms of use
            </Link>
            .
          </p>
        </section>
      </div>
    </section>
  );
}
