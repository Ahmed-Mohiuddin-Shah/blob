import Link from "next/link";

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-wider text-inactive">
        Legal
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        Terms of use
      </h1>
      <p className="mt-2 text-sm text-secondary">Last updated: 24 Sep 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-secondary">
        <section>
          <h2 className="text-base font-semibold text-foreground">The service</h2>
          <p className="mt-2">
            BLOB is a public sticker library and related tools (browse, upload,
            prints). You use it as-is. We may change or interrupt features
            without notice.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Your uploads</h2>
          <p className="mt-2">
            Only upload content you have the right to share. Do not upload
            illegal, abusive, or others&apos; copyrighted material without
            permission. You are responsible for what you submit.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Human moderation
          </h2>
          <p className="mt-2">
            Moderation is done by <strong className="text-foreground">human
            admins</strong>, not automated content classifiers. Admins review
            submissions to keep the library clean and to avoid spam and
            bombardment.
          </p>
          <p className="mt-2">
            While a sticker is awaiting review or an edit request, admins may
            view it — including if you marked it private or unlisted — so they
            can decide. After approval, <strong className="text-foreground">private</strong> stickers
            are visible only to you. <strong className="text-foreground">Unlisted</strong> stickers stay
            reachable by anyone with the link (same as any visitor).
          </p>
          <p className="mt-2">
            Rejecting a sticker may permanently delete its media from our
            storage and remove it from BLOB.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Physical prints and sticker sheets
          </h2>
          <p className="mt-2">
            We may offer for sale physical sticker sheets (prints) produced from
            stickers and collections that are publicly available on BLOB. Any
            such sale is limited to recovery of costs associated with
            manufacture, packaging, hosting and related infrastructure, and
            shipping or other transport — not a claim of ownership over the
            underlying creative works.
          </p>
          <p className="mt-2">
            Except where we expressly state otherwise, we do not claim copyright
            or other intellectual-property rights in individual stickers,
            print layouts, or pack compositions contributed by users or third
            parties. Rights in those materials remain with their respective
            owners. By making a sticker public on BLOB, you grant us a
            non-exclusive licence to reproduce it on physical sheets solely for
            the print offerings described above (and for operating the online
            library). Digital downloads and on-site display remain governed by
            the visibility and attribution settings of each sticker.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Advertising</h2>
          <p className="mt-2">
            We may display advertisements on the service. We do not sell your
            personal data to advertisers. How advertising relates to personal
            information is described in our{" "}
            <Link href="/privacy" className="font-semibold text-accent-pink hover:underline">
              Privacy policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Accounts</h2>
          <p className="mt-2">
            We may suspend or ban accounts that break these terms or harm the
            community. Role and status are managed by admins.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Changes</h2>
          <p className="mt-2">
            We may update these terms. Continued use after a change means you
            accept the new version. See also our{" "}
            <Link href="/privacy" className="font-semibold text-accent-pink hover:underline">
              Privacy policy
            </Link>
            .
          </p>
        </section>
      </div>
    </section>
  );
}
