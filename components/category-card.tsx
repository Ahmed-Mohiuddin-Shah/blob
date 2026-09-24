import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Props = {
  name: string;
  slug: string;
  icon: LucideIcon;
  color?: string;
};

export function CategoryCard({
  name,
  slug,
  icon: Icon,
  color = "bg-accent-gradient",
}: Props) {
  return (
    <Link
      href={`/stickers?category=${encodeURIComponent(slug)}`}
      className="group relative rounded-3xl border border-divider bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent-pink/30 hover:shadow-xl hover:shadow-accent-pink/5"
    >
      <div
        className={`mb-8 flex h-11 w-11 items-center justify-center rounded-full ${color} text-white transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="font-semibold">{name}</h3>
      <p className="mt-1 text-xs text-secondary">Browse stickers</p>
    </Link>
  );
}
