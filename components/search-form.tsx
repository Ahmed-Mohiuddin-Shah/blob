import Link from "next/link";

type Props = {
  action?: string;
  placeholder?: string;
  popular?: string[];
  className?: string;
};

export function SearchForm({
  action = "/stickers",
  placeholder = "Search cats, reactions, memes...",
  popular = [],
  className = "",
}: Props) {
  return (
    <div className={className}>
      <form action={action} method="GET" className="mx-auto max-w-2xl">
        <div className="group relative flex items-center rounded-[2rem] border border-divider bg-surface p-2 shadow-xl shadow-black/5 transition-all duration-300 focus-within:border-accent-pink/50 focus-within:shadow-2xl focus-within:shadow-accent-pink/10">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.4a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z" />
            </svg>
          </div>
          <input
            type="search"
            name="q"
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-inactive"
            autoComplete="off"
          />
          <button
            type="submit"
            className="hidden rounded-full bg-accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-md shadow-accent-pink/20 transition-transform duration-200 hover:scale-[1.03] sm:block"
          >
            Search
          </button>
        </div>
      </form>

      {popular.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="mr-1 text-inactive">Popular:</span>
          {popular.map((term) => (
            <Link
              key={term}
              href={`${action}?q=${encodeURIComponent(term)}`}
              className="rounded-full border border-divider px-3 py-1.5 text-secondary transition-colors hover:border-accent-pink/40 hover:text-accent-pink"
            >
              {term}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
