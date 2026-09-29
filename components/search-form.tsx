"use client";

import Link from "next/link";
import { SearchBar } from "@/components/search-bar";

type Props = {
  action?: string;
  placeholder?: string;
  popular?: string[];
  className?: string;
  /** Guest → keywords; signed-in defaults set by parent */
  searchMode?: string;
  showCamera?: boolean;
};

export function SearchForm({
  action = "/search",
  placeholder = "Search cats, reactions, memes...",
  popular = [],
  className = "",
  searchMode = "keywords",
  showCamera = false,
}: Props) {
  return (
    <div className={className}>
      <SearchBar
        variant="hero"
        placeholder={placeholder}
        navigateTo={action}
        defaultMode={searchMode}
        showCamera={showCamera}
        className="mx-auto max-w-2xl"
      />

      {popular.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="mr-1 text-inactive">Popular:</span>
          {popular.map((term) => (
            <Link
              key={term}
              href={`/search?q=${encodeURIComponent(term)}&mode=${encodeURIComponent(searchMode)}`}
              className="rounded-full border border-divider bg-surface px-3 py-1.5 text-secondary transition-colors hover:border-accent-pink/40 hover:text-accent-pink"
            >
              {term}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
