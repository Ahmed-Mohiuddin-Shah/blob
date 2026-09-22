"use client";

import { useEffect, useState } from "react";

const modes = ["light", "system", "dark"] as const;
type Mode = (typeof modes)[number];

declare global {
  interface Window {
    __theme?: {
      get: () => Mode;
      set: (pref: Mode) => void;
    };
  }
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [active, setActive] = useState<Mode>("system");

  useEffect(() => {
    const sync = () => setActive(window.__theme?.get() ?? "system");
    sync();
    const onChange = () => sync();
    document.documentElement.addEventListener("themechange", onChange);
    return () => document.documentElement.removeEventListener("themechange", onChange);
  }, []);

  return (
    <div
      className={`inline-flex rounded-full border border-divider bg-surface/70 p-1 ${className}`}
      role="group"
      aria-label="Color theme"
    >
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => {
            window.__theme?.set(mode);
            setActive(mode);
          }}
          className="rounded-full px-2.5 py-1.5 text-secondary transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm"
          data-active={active === mode}
          aria-label={`${mode} theme`}
          aria-pressed={active === mode}
          title={mode}
        >
          {mode === "light" ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
            </svg>
          ) : mode === "dark" ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <path strokeLinecap="round" d="M8 20h8" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
