"use client";

import { useLayoutEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

const modes = ["light", "system", "dark"] as const;
type Mode = (typeof modes)[number];

const icons = { light: Sun, system: Monitor, dark: Moon } as const;

declare global {
  interface Window {
    __theme?: {
      get: () => Mode;
      set: (pref: Mode) => void;
      apply: (pref?: Mode) => void;
    };
  }
}

function nextMode(current: Mode): Mode {
  return modes[(modes.indexOf(current) + 1) % modes.length]!;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [active, setActive] = useState<Mode>("system");

  useLayoutEffect(() => {
    // Re-apply after hydration — React can wipe html.dark that the blocking
    // ThemeScript set, while localStorage (and thus the button) stay correct.
    window.__theme?.apply();
    const sync = () => setActive(window.__theme?.get() ?? "system");
    sync();
    const onChange = () => sync();
    document.documentElement.addEventListener("themechange", onChange);
    return () => document.documentElement.removeEventListener("themechange", onChange);
  }, []);

  const Icon = icons[active];
  const upcoming = nextMode(active);

  return (
    <button
      type="button"
      onClick={() => {
        const next = nextMode(active);
        window.__theme?.set(next);
        setActive(next);
      }}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-divider bg-surface/70 text-foreground transition-colors hover:border-accent-pink/40 sm:min-h-0 sm:min-w-0 sm:h-9 sm:w-9 ${className}`}
      aria-label={`Theme: ${active}. Click for ${upcoming}.`}
      title={`Theme: ${active}`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
