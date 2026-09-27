"use client";

import { useEffect, useId, useRef, useState } from "react";

export type BlobberPick = {
  id: string | null;
  displayName: string;
};

type Suggestion = { id: string; displayName: string; linked: boolean };

export function BlobberCombobox({
  value,
  onChange,
  allowCreate = true,
}: {
  value: BlobberPick | null;
  onChange: (pick: BlobberPick | null) => void;
  allowCreate?: boolean;
}) {
  const [draft, setDraft] = useState(value?.displayName ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value?.displayName ?? "");
  }, [value?.displayName]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = draft.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/blobbers?typeahead=1&q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as { items: Suggestion[] };
        setSuggestions(json.items);
        setOpen(true);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft]);

  const exactMatch = suggestions.find(
    (s) => s.displayName.toLowerCase() === draft.trim().toLowerCase(),
  );

  function select(s: Suggestion) {
    onChange({ id: s.id, displayName: s.displayName });
    setDraft(s.displayName);
    setOpen(false);
  }

  function commitCreate() {
    const name = draft.trim().slice(0, 200);
    if (!name) {
      onChange(null);
      return;
    }
    if (exactMatch) {
      select(exactMatch);
      return;
    }
    if (!allowCreate) return;
    onChange({ id: null, displayName: name });
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (value) onChange(null);
        }}
        onBlur={() => {
          setTimeout(() => {
            setOpen(false);
            if (draft.trim() && !value) commitCreate();
          }, 150);
        }}
        onFocus={() => suggestions.length && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitCreate();
          }
        }}
        placeholder="Search Blobbers…"
        className="mt-1 w-full rounded-2xl border border-divider bg-surface px-4 py-2.5 outline-none transition focus:border-accent-pink/50"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
      />
      {value?.id ? (
        <p className="mt-1 text-xs text-secondary">Selected · id {value.id}</p>
      ) : value?.displayName ? (
        <p className="mt-1 text-xs text-secondary">
          Will create or merge: {value.displayName}
        </p>
      ) : null}
      {open && (suggestions.length || (allowCreate && draft.trim() && !exactMatch)) ? (
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
                onClick={() => select(s)}
              >
                {s.displayName}
                {s.linked ? (
                  <span className="ml-2 text-xs text-inactive">linked</span>
                ) : null}
              </button>
            </li>
          ))}
          {allowCreate && draft.trim() && !exactMatch ? (
            <li>
              <button
                type="button"
                role="option"
                className="w-full px-4 py-2 text-left text-sm text-accent-pink hover:bg-badge"
                onMouseDown={(e) => e.preventDefault()}
                onClick={commitCreate}
              >
                Create “{draft.trim()}”
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
