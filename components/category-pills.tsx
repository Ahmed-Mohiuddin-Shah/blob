import Link from "next/link";

export type CategoryPill = { name: string; slug: string };

export function CategoryPills({
  categories,
  activeSlug,
  basePath = "/stickers",
  className = "",
}: {
  categories: CategoryPill[];
  activeSlug?: string | null;
  basePath?: string;
  className?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className="mr-1 text-inactive">Popular:</span>
      {categories.map((c) => {
        const active = activeSlug === c.slug;
        return (
          <Link
            key={c.slug}
            href={`${basePath}?category=${encodeURIComponent(c.slug)}`}
            className={`rounded-full border px-3 py-1.5 transition-colors ${
              active
                ? "border-transparent bg-accent-gradient text-white"
                : "border-divider bg-surface text-secondary hover:border-accent-pink/40 hover:text-accent-pink"
            }`}
          >
            {c.name}
          </Link>
        );
      })}
    </div>
  );
}
