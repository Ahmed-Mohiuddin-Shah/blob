import type { LucideIcon } from "lucide-react";
import { CategoryCard } from "../category-card";
import { SectionHeading } from "../section-heading";

export type CategoryItem = { name: string; icon: LucideIcon; className: string };

export function Categories({ categories }: { categories: CategoryItem[] }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
      <SectionHeading eyebrow="Explore" title="Browse the blob" href="/categories" link="All categories →" linkClassName="hidden sm:block" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {categories.map((c) => (
          <CategoryCard key={c.name} name={c.name} icon={c.icon} color={c.className} />
        ))}
      </div>
    </section>
  );
}
