import Link from "next/link";

type Props = {
  eyebrow: string;
  title: string;
  href?: string;
  link?: string;
  accent?: "pink" | "orange";
  /** Zune overflow: oversized light lowercase title, baseline flush, never clipped */
  zune?: boolean;
  linkClassName?: string;
  className?: string;
};

const accents = {
  pink: "text-accent-pink",
  orange: "text-accent-orange",
};

export function SectionHeading({
  eyebrow,
  title,
  href,
  link,
  accent = "pink",
  zune = false,
  linkClassName = "",
  className = "",
}: Props) {
  return (
    <div className={`mb-7 flex items-end justify-between overflow-visible ${className}`}>
      <div className="overflow-visible">
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] leading-none ${accents[accent]}`}>{eyebrow}</p>
        <h2
          className={
            zune
              ? "mt-0.5 text-[4.5rem] font-light lowercase leading-none tracking-tight overflow-visible"
              : "mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          }
        >
          {title}
        </h2>
      </div>
      {href && link ? (
        <Link href={href} className={`text-sm font-semibold text-inactive transition-colors hover:text-foreground ${linkClassName}`}>
          {link}
        </Link>
      ) : null}
    </div>
  );
}
