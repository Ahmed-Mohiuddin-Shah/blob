import Link from "next/link";
import type { ReactNode } from "react";
import {
  BookOpen,
  Heart,
  Layers,
  Printer,
  Scale,
  Sparkles,
  Square,
  type LucideIcon,
} from "lucide-react";

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-divider bg-surface p-6 sm:p-7">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent-gradient text-white">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-secondary">{children}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <section className="relative overflow-x-clip">
      <div
        className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-[48%_52%_60%_40%/55%_45%_55%_45%] bg-accent-gradient opacity-20 blur-2xl sm:h-96 sm:w-96"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-0 h-56 w-56 rounded-full bg-accent-pink/15 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-pink">
          About
        </p>
        <h1 className="mt-3 overflow-visible text-5xl font-light lowercase leading-[0.95] tracking-tight text-foreground sm:text-7xl">
          a library
          <br />
          of stickers
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-secondary sm:text-lg">
          BLOB is a shared place for stickers that actually fit — proper
          squares, clean exports, and a library you can browse, remix, and
          print from. Built so we can keep our favourites in one nice format.
        </p>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          <Feature icon={Square} title="Proper squares">
            Stickers live as composition documents at 1024×1024 with chat,
            thumbnail, and full derivatives. Squares first — not stretched
            phone screenshots pretending to be stickers.
          </Feature>
          <Feature icon={BookOpen} title="A common library">
            Browse, search, favourite, and collect. Members upload and remix;
            everyone can download what the library publishes. One place for
            the stickers we actually use.
          </Feature>
          <Feature icon={Printer} title="Sheets & packs">
            Lay stickers on printable pages, bundle sheets into packs, and
            take PDF or PNG home. Same stickers you browse — ready for paper.
          </Feature>
          <Feature icon={Sparkles} title="As-is">
            The site is offered as-is. Features may change, break, or take a
            nap. No warranty — just stickers and questionable decisions.
          </Feature>
        </div>

        <div className="mt-12 overflow-hidden rounded-[2.5rem] border border-divider bg-quickplay p-8 text-white sm:p-10">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent-gradient">
            <Scale className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Copyright &amp; takedowns
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-white/70 sm:text-base">
            <p>
              I do <strong className="font-semibold text-white">not</strong>{" "}
              claim copyright over content hosted on BLOB. Stickers, sheets,
              packs, and collections remain with whoever contributed them (or
              their respective rights holders).
            </p>
            <p>
              BLOB will{" "}
              <strong className="font-semibold text-white">not</strong> take
              down user uploads on request from me as the site operator for
              copyright ownership of that content — because I am not claiming
              ownership of it. Uploaders are responsible for what they share.
              How the library is moderated for spam and abuse is described in
              the{" "}
              <Link
                href="/terms"
                className="font-semibold text-accent-pink hover:underline"
              >
                Terms
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-[2rem] border border-divider bg-surface p-6 sm:flex sm:items-start sm:gap-5 sm:p-8">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white">
            <Heart className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="mt-4 sm:mt-0">
            <h2 className="text-lg font-semibold tracking-tight">
              Why it exists
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Mostly so I — and anyone else who wants in — can keep a common,
              tidy sticker library: consistent squares, remixable documents,
              favourites and collections, and prints when we need a sheet.
              Less hunting through chat archives. More stickers that look
              right.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-secondary">
              <Layers className="h-4 w-4 text-accent-pink" strokeWidth={1.75} />
              Pixels, pink-to-orange, and a bit of chaos.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/stickers"
            className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
          >
            Browse stickers
          </Link>
          <Link
            href="/prints"
            className="rounded-full border border-divider bg-surface px-5 py-2.5 text-sm font-semibold hover:border-accent-pink/40"
          >
            Explore prints
          </Link>
          <Link
            href="/terms"
            className="rounded-full border border-divider px-5 py-2.5 text-sm font-semibold text-secondary hover:text-foreground"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="rounded-full border border-divider px-5 py-2.5 text-sm font-semibold text-secondary hover:text-foreground"
          >
            Privacy
          </Link>
        </div>
      </div>
    </section>
  );
}
