"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { CompositionDocument, ExportPayload } from "blob-editor/core";
import "blob-editor/react/blob-editor.css";

const BlobEditor = dynamic(
  () => import("blob-editor/react").then((m) => m.BlobEditor),
  { ssr: false, loading: () => <EditorSkeleton label="Loading editor…" /> },
);

const PRIMARY = "#f10ea0";
const SECONDARY = "#e95214";

type ThemeMode = "light" | "dark" | "system";

function EditorSkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-divider bg-surface p-8">
      <div className="h-48 w-48 animate-pulse rounded-[2rem] bg-badge sm:h-64 sm:w-64" />
      <p className="text-sm text-secondary">{label}</p>
    </div>
  );
}

function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    const read = () => {
      const t =
        (typeof window !== "undefined" &&
          (window as unknown as { __theme?: { get: () => string } }).__theme?.get()) ||
        localStorage.getItem("theme") ||
        "system";
      if (t === "light" || t === "dark" || t === "system") setMode(t);
    };
    read();
    const onChange = () => read();
    document.documentElement.addEventListener("themechange", onChange);
    return () =>
      document.documentElement.removeEventListener("themechange", onChange);
  }, []);
  return mode;
}

export type BlobEditorHostProps = {
  sourceAsset?: string | File | Blob;
  document?: CompositionDocument | unknown;
  onExport: (payload: ExportPayload) => void | Promise<void>;
  onCancel?: () => void;
};

/** Prefetch URL sourceAssets to Blob so BlobEditor never flashes the empty pick UI. */
function useResolvedSourceAsset(sourceAsset?: string | File | Blob) {
  const [resolved, setResolved] = useState<File | Blob | undefined>(() =>
    sourceAsset && typeof sourceAsset !== "string" ? sourceAsset : undefined,
  );
  const [loading, setLoading] = useState(
    () => typeof sourceAsset === "string" && !!sourceAsset,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceAsset) {
      setResolved(undefined);
      setLoading(false);
      setError(null);
      return;
    }
    if (typeof sourceAsset !== "string") {
      setResolved(sourceAsset);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setResolved(undefined);

    void (async () => {
      try {
        const res = await fetch(sourceAsset);
        if (!res.ok) throw new Error("Failed to load asset");
        const blob = await res.blob();
        if (!cancelled) {
          setResolved(blob);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load image");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceAsset]);

  return { resolved, loading, error };
}

export function BlobEditorHost({
  sourceAsset,
  document,
  onExport,
  onCancel,
}: BlobEditorHostProps) {
  const themeMode = useThemeMode();
  const [busy, setBusy] = useState(false);
  const { resolved, loading, error } = useResolvedSourceAsset(sourceAsset);

  if (typeof sourceAsset === "string" && loading) {
    return <EditorSkeleton label="Loading image…" />;
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-[1.5rem] border border-divider bg-surface p-8">
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[70vh] w-full overflow-hidden rounded-[1.5rem] border border-divider bg-surface">
      {busy ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm font-semibold">
          Saving…
        </div>
      ) : null}
      <BlobEditor
        sourceAsset={resolved}
        document={document}
        primary={PRIMARY}
        secondary={SECONDARY}
        onPrimary="#fff"
        onSecondary="#fff"
        blocky={false}
        themeMode={themeMode}
        onCancel={onCancel}
        onExport={(payload) => {
          setBusy(true);
          void Promise.resolve(onExport(payload)).finally(() => setBusy(false));
        }}
      />
    </div>
  );
}
