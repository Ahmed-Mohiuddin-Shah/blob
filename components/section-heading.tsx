import Link from "next/link";

type Props = {
  eyebrow: string;
  title: string;
  href?: string;
  link?: string;
  accent?: "pink" | "orange";
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
  linkClassName = "",
  className = "",
}: Props) {
  return (
    <div className={`mb-7 flex items-end justify-between ${className}`}>
      <div>
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${accents[accent]}`}>{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {href && link ? (
        <Link href={href} className={`text-sm font-semibold text-secondary transition-colors hover:text-foreground ${linkClassName}`}>
          {link}
        </Link>
      ) : null}
    </div>
  );
}
