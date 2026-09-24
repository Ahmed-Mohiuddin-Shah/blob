import { SectionHeading } from "../section-heading";
import { StickerCard, type StickerCardProps } from "../sticker-card";

export function Featured({ stickers }: { stickers: StickerCardProps[] }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
      <SectionHeading
        className="mb-8"
        eyebrow="Fresh from the blob"
        title="Featured stickers"
        href="/stickers"
        link="Browse all →"
        accent="orange"
      />
      {stickers.length === 0 ? (
        <p className="py-8 text-center text-sm text-secondary">
          No public stickers yet.{" "}
          <a href="/stickers" className="font-semibold text-accent-pink hover:underline">
            Browse the library →
          </a>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {stickers.map((s) => (
            <StickerCard key={s.href} {...s} />
          ))}
        </div>
      )}
    </section>
  );
}
