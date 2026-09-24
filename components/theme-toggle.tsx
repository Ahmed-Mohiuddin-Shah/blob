"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

const modes = ["light", "system", "dark"] as const;
type Mode = (typeof modes)[number];

const icons = { light: Sun, system: Monitor, dark: Moon } as const;

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
      {modes.map((mode) => {
        const Icon = icons[mode];
        return (
          <button
            key={mode}
            type="button"
            onClick={() => {
              window.__theme?.set(mode);
              setActive(mode);
            }}
            className="rounded-full px-2.5 py-1.5 text-inactive transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm"
            data-active={active === mode}
            aria-label={`${mode} theme`}
            aria-pressed={active === mode}
            title={mode}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
