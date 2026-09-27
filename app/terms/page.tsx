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
      <p className="mt-2 text-sm text-secondary">Last updated: 27 Sep 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-secondary">
        <section>
          <h2 className="text-base font-semibold text-foreground">The service</h2>
          <p className="mt-2">
            BLOB is a public sticker library and related tools (browse, upload,
            prints, Blobber profiles, and attribution). You use it as-is. We
            may change or interrupt features without notice.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Your uploads</h2>
          <p className="mt-2">
            Only upload content you have the right to share — you own it, you
            have permission, or you have another lawful basis. Do not upload
            illegal, abusive, or others&apos; copyrighted material without
            that right. By uploading, you represent that your submission does
            not infringe others&apos; rights. You are responsible for what you
            submit.
          </p>
          <p className="mt-2">
            Prefer attributing every upload (yourself, another Blobber, or
            unknown). Crediting another creator — including creating an
            unlinked Blobber by name or adding a source URL — is credit only.
            It is <strong className="text-foreground">not</strong> permission
            or a licence from them, and it does not imply they uploaded the
            work. If you lack the right to share it, do not upload it — even
            with perfect credit.
          </p>
          <p className="mt-2">
            If your upload or misattribution infringes someone&apos;s rights
            or breaks these terms, you agree to cover losses we reasonably
            incur as a result.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Blobbers &amp; attribution
          </h2>
          <p className="mt-2">
            A Blobber is a public credit identity, separate from a private
            BLOB account. Stickers can credit a linked Blobber (tied to an
            account) or an unlinked Blobber (credit-only, for creators who
            are not on BLOB yet). Unlinked profiles let their work sit under
            one name, with optional social and merch links, so credit can
            point people back to the creator.
          </p>
          <p className="mt-2">
            The uploader of a sticker is not necessarily the credited
            Blobber. Members may find or create an unlinked Blobber when
            attributing an upload. Attribution claims (fix sticker credit)
            and association requests (link an account to an unlinked Blobber)
            are reviewed by human admins; approving them may re-point sticker
            credit or attach an account to that profile.
          </p>
          <p className="mt-2">
            Do not invent fake creators, spam unlinked names, or
            misattribute on purpose. Abuse can get content and accounts
            moderated.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Copyright complaints
          </h2>
          <p className="mt-2">
            Rights holders (or their agents) may report unauthorized content
            through the admin contact channel published for this instance.
            After human review, we may remove or restrict the content,
            related print or sheet visibility where applicable, and/or the
            uploader&apos;s account — without needing the uploader&apos;s
            agreement. Attribution on a sticker does not block removal.
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
            Digital sticker sheets and sticker packs you create on BLOB are
            always public. If you include private or unlisted stickers in a
            sheet, their artwork will appear on that public printable download
            (PDF/PNG) even though the original sticker page may remain private
            or unlisted. Confirm this when creating a sheet that mixes
            visibility.
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
            the visibility and attribution settings of each sticker, except as
            described for sheets and packs above.
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
