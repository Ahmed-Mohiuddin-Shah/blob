"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { id: string; name: string };

export function TagPillsInput({
  value,
  onChange,
  max = 20,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = draft.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tags?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const json = (await res.json()) as { items: Suggestion[] };
        setSuggestions(
          json.items.filter(
            (s) => !value.some((v) => v.toUpperCase() === s.name.toUpperCase()),
          ),
        );
        setOpen(true);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, value]);

  function addTag(raw: string) {
    const name = raw.trim().replace(/^#/, "");
    if (!name) return;
    const upper = name.toUpperCase().slice(0, 80);
    if (value.some((v) => v.toUpperCase() === upper)) {
      setDraft("");
      return;
    }
    if (value.length >= max) return;
    onChange([...value, upper]);
    setDraft("");
    setSuggestions([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (draft.trim()) {
        e.preventDefault();
        addTag(draft);
      }
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!/[,#\n]/.test(text)) return;
    e.preventDefault();
    const parts = text.split(/[,#\n]+/).map((t) => t.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) {
      const upper = p.toUpperCase().slice(0, 80);
      if (next.some((v) => v.toUpperCase() === upper)) continue;
      if (next.length >= max) break;
      next.push(upper);
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div className="relative">
      <div className="flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-2xl border border-divider bg-surface px-3 py-2 focus-within:border-accent-pink/50">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-badge px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-foreground"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="rounded-full p-0.5 text-secondary hover:text-foreground"
            >
              <X className="h-3 w-3" strokeWidth={1.75} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={value.length ? "" : "Type a tag…"}
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
        />
      </div>
      {open && suggestions.length ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-2xl border border-divider bg-surface py-1 shadow-lg"
        >
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                className="w-full px-4 py-2 text-left text-sm hover:bg-badge"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(s.name)}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
