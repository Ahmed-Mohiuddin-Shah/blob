import Link from "next/link";

type Props = {
  name: string;
  symbol: string;
  color?: string;
};

export function CategoryCard({ name, symbol, color = "bg-accent-pink" }: Props) {
  return (
    <Link
      href={`/stickers?category=${encodeURIComponent(name)}`}
      className="group relative overflow-hidden rounded-3xl border border-divider bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent-pink/30 hover:shadow-xl hover:shadow-accent-pink/5"
    >
      <div
        className={`mb-8 flex h-11 w-11 items-center justify-center rounded-[45%_55%_60%_40%/55%_45%_55%_45%] ${color} text-lg font-semibold text-white transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110`}
      >
        {symbol}
      </div>
      <h3 className="font-semibold">{name}</h3>
      <p className="mt-1 text-xs text-secondary">Browse stickers</p>
    </Link>
  );
}
