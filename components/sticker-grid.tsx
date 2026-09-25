import { StickerCard, type StickerCardProps } from "./sticker-card";

export function StickerGrid({ items }: { items: StickerCardProps[] }) {
  if (items.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-secondary">No stickers yet.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 sm:gap-5">
      {items.map((item) => (
        <StickerCard
          key={(item.stickerId ?? item.href) + item.title}
          {...item}
        />
      ))}
    </div>
  );
}
