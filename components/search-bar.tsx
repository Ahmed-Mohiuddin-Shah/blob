"use client";

import { Camera, Search, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BusyButton } from "@/components/busy-button";
import {
  fileToSearchMedia,
  isSearchMediaFile,
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
  /** Media picked / dropped / pasted. If omitted, handoff → /search?mode=visual */
  onImageSearch?: (file: File) => void;
  onAgentSearch?: (q: string) => void;
  /** GET-style navigation target for text search when onSubmit omitted */
  navigateTo?: string;
  /** Optional mode query param when navigating */
  defaultMode?: string;
  className?: string;
  /** Hide gradient Search button (e.g. docked library) */
  hideSubmit?: boolean;
  /** Controlled preview (e.g. handoff on /search). Overrides internal preview. */
  imagePreviewUrl?: string | null;
  /** When preview is a video blob/data URL — render <video> not <img>. */
  imagePreviewMime?: string | null;
  onClearImagePreview?: () => void;
};

function fileFromClipboard(e: React.ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (
      item.kind === "file" &&
      (item.type.startsWith("image/") || item.type.startsWith("video/"))
    ) {
      return item.getAsFile();
    }
  }
  const files = e.clipboardData?.files;
  if (files?.length) {
    for (const file of files) {
      if (isSearchMediaFile(file)) return file;
    }
  }
  return null;
}

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
  defaultMode,
  className = "",
  hideSubmit = false,
  imagePreviewUrl,
  imagePreviewMime = null,
  onClearImagePreview,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [internal, setInternal] = useState(defaultValue);
  const [dragging, setDragging] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const localPreviewRef = useRef<string | null>(null);
  const q = value !== undefined ? value : internal;
  const dropEnabled = enableImageDrop ?? showCamera;
  const compact = variant === "library";
  const preview =
    imagePreviewUrl !== undefined ? imagePreviewUrl : localPreview;

  useEffect(() => {
    return () => {
      if (localPreviewRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
    };
  }, []);

  function setLocalPreviewUrl(url: string | null) {
    if (localPreviewRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(localPreviewRef.current);
    }
    localPreviewRef.current = url;
    setLocalPreview(url);
  }

  function setQ(next: string) {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }

  function clearPreview() {
    if (imagePreviewUrl !== undefined) {
      onClearImagePreview?.();
      return;
    }
    setLocalPreviewUrl(null);
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
      if (defaultMode) params.set("mode", defaultMode);
      const qs = params.toString();
      router.push(qs ? `${navigateTo}?${qs}` : navigateTo);
    }
  }

  async function handleImage(file: File | null) {
    if (!file || !isSearchMediaFile(file)) return;
    if (imagePreviewUrl === undefined) {
      setLocalPreviewUrl(URL.createObjectURL(file));
    }
    if (onImageSearch) {
      onImageSearch(file);
      return;
    }
    const payload = await fileToSearchMedia(file);
    stashImageHandoff(payload);
    const params = new URLSearchParams({ mode: "visual" });
    const trimmed = q.trim();
    if (trimmed) params.set("q", trimmed);
    router.push(`/search?${params}`);
  }

  function handlePaste(e: React.ClipboardEvent) {
    if (!dropEnabled) return;
    const file = fileFromClipboard(e);
    if (!file) return;
    e.preventDefault();
    void handleImage(file);
  }

  const thumb = compact ? "h-7 w-7" : "h-9 w-9";

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
        {preview ? (
          <div className={`relative mr-1 shrink-0 ${thumb}`}>
            {imagePreviewMime?.startsWith("video/") ? (
              <video
                src={preview}
                muted
                playsInline
                autoPlay
                loop
                className={`${thumb} rounded-full object-cover ring-1 ring-divider`}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- blob/data URL preview
              <img
                src={preview}
                alt="Search visual"
                className={`${thumb} rounded-full object-cover ring-1 ring-divider`}
              />
            )}
            <button
              type="button"
              aria-label="Clear search visual"
              title="Clear search visual"
              onClick={clearPreview}
              className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow">
                <X className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
              </span>
            </button>
          </div>
        ) : null}
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onPaste={handlePaste}
          placeholder={
            preview
              ? "Add words to refine the visual search…"
              : placeholder
          }
          aria-label={
            preview ? "Refine visual search" : placeholder || "Search stickers"
          }
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
                aria-label="Search with visual"
                title="Search with image, GIF, or video (or paste)"
                className="flex h-11 w-11 items-center justify-center rounded-full text-inactive transition-colors hover:bg-black/5 hover:text-accent-pink sm:h-9 sm:w-9"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
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
              className="flex h-11 w-11 items-center justify-center rounded-full text-inactive transition-colors hover:bg-black/5 hover:text-accent-pink sm:h-9 sm:w-9"
              onClick={() => onAgentSearch?.(q.trim())}
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
          {!hideSubmit ? (
            <BusyButton
              type="submit"
              busy={busy}
              className={`inline-flex rounded-full bg-accent-gradient text-sm font-semibold text-white shadow-md shadow-accent-pink/20 transition-transform duration-200 hover:scale-[1.03] ${
                compact ? "px-3 py-1.5 text-xs" : "px-5 py-3 sm:px-6"
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
