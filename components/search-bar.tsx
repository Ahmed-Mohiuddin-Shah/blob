"use client";

import { Camera, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BusyButton } from "@/components/busy-button";
import {
  fileToHandoff,
  stashImageHandoff,
} from "@/lib/search/image-handoff";

export type SearchBarVariant = "hero" | "library" | "universal";

type Props = {
  variant?: SearchBarVariant;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (q: string) => void;
  showCamera?: boolean;
  showAgent?: boolean;
  enableImageDrop?: boolean;
  busy?: boolean;
  submitLabel?: string;
  /** Text submit. If omitted and navigateTo set, pushes navigateTo?q= */
  onSubmit?: (q: string) => void;
  /** Image picked / dropped. If omitted, handoff → /search?mode=image */
  onImageSearch?: (file: File) => void;
  onAgentSearch?: (q: string) => void;
  /** GET-style navigation target for text search when onSubmit omitted */
  navigateTo?: string;
  className?: string;
  /** Hide gradient Search button (e.g. docked library) */
  hideSubmit?: boolean;
};

export function SearchBar({
  variant = "hero",
  placeholder = "Search cats, reactions, memes...",
  value,
  defaultValue = "",
  onChange,
  showCamera = true,
  showAgent = false,
  enableImageDrop,
  busy = false,
  submitLabel = "Search",
  onSubmit,
  onImageSearch,
  onAgentSearch,
  navigateTo,
  className = "",
  hideSubmit = false,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [internal, setInternal] = useState(defaultValue);
  const [dragging, setDragging] = useState(false);
  const q = value !== undefined ? value : internal;
  const dropEnabled = enableImageDrop ?? showCamera;
  const compact = variant === "library";

  function setQ(next: string) {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (onSubmit) {
      onSubmit(trimmed);
      return;
    }
    if (navigateTo) {
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      const qs = params.toString();
      router.push(qs ? `${navigateTo}?${qs}` : navigateTo);
    }
  }

  async function handleImage(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    if (onImageSearch) {
      onImageSearch(file);
      return;
    }
    const payload = await fileToHandoff(file);
    stashImageHandoff(payload);
    router.push("/search?mode=image");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
      onDragEnter={(e) => {
        if (!dropEnabled) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!dropEnabled) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!dropEnabled) return;
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(e) => {
        if (!dropEnabled) return;
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0] ?? null;
        void handleImage(file);
      }}
    >
      <div
        className={`group relative flex items-center rounded-full border bg-surface shadow-xl shadow-black/5 transition-all duration-300 focus-within:border-accent-pink/50 focus-within:shadow-2xl focus-within:shadow-accent-pink/10 ${
          dragging
            ? "border-accent-pink ring-2 ring-accent-pink/30"
            : "border-divider"
        } ${compact ? "p-1" : "p-2"}`}
      >
        <div
          className={`flex shrink-0 items-center justify-center text-inactive ${
            compact ? "h-9 w-9" : "h-12 w-12"
          }`}
        >
          <Search
            className={compact ? "h-4 w-4" : "h-5 w-5"}
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-inactive ${
            compact ? "px-1 text-sm" : "px-2 text-base"
          }`}
          autoComplete="off"
        />
        <div className="flex shrink-0 items-center gap-0.5 pr-1">
          {showCamera ? (
            <>
              <button
                type="button"
                aria-label="Search with image"
                title="Search with image"
                className="flex h-9 w-9 items-center justify-center rounded-full text-inactive transition-colors hover:bg-black/5 hover:text-accent-pink"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handleImage(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </>
          ) : null}
          {showAgent ? (
            <button
              type="button"
              aria-label="Agent search"
              title="Agent search"
                className="flex h-9 w-9 items-center justify-center rounded-full text-inactive transition-colors hover:bg-black/5 hover:text-accent-pink"
              onClick={() => onAgentSearch?.(q.trim())}
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
          {!hideSubmit ? (
            <BusyButton
              type="submit"
              busy={busy}
              className={`rounded-full bg-accent-gradient text-sm font-semibold text-white shadow-md shadow-accent-pink/20 transition-transform duration-200 hover:scale-[1.03] ${
                compact
                  ? "px-3 py-1.5 text-xs"
                  : "hidden px-6 py-3 sm:inline-flex"
              }`}
            >
              {submitLabel}
            </BusyButton>
          ) : null}
        </div>
      </div>
    </form>
  );
}
