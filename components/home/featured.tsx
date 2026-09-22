import { SectionHeading } from "../section-heading";
import { StickerCard } from "../sticker-card";

export type StickerItem = {
  title: string;
  author: string;
  type: string;
  color: string;
};

export function Featured({ stickers }: { stickers: StickerItem[] }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
      <SectionHeading className="mb-8" eyebrow="Fresh from the blob" title="Featured stickers" href="/stickers" link="Browse all →" accent="orange" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {stickers.map((s, i) => (
          <StickerCard key={s.title} title={s.title} author={s.author} type={s.type} color={s.color} href={`/stickers/${i + 1}`} />
        ))}
      </div>
    </section>
  );
}
