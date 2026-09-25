"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { CompositionDocument, ExportPayload } from "blob-editor/core";
import "blob-editor/react/blob-editor.css";

const BlobEditor = dynamic(
  () => import("blob-editor/react").then((m) => m.BlobEditor),
  { ssr: false, loading: () => <p className="py-20 text-center text-sm text-secondary">Loading editor…</p> },
);

const PRIMARY = "#f10ea0";
const SECONDARY = "#e95214";

type ThemeMode = "light" | "dark" | "system";

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

export function BlobEditorHost({
  sourceAsset,
  document,
  onExport,
  onCancel,
}: BlobEditorHostProps) {
  const themeMode = useThemeMode();
  const [busy, setBusy] = useState(false);

  return (
    <div className="relative min-h-[70vh] w-full overflow-hidden rounded-[1.5rem] border border-divider bg-surface">
      {busy ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm font-semibold">
          Saving…
        </div>
      ) : null}
      <BlobEditor
        sourceAsset={sourceAsset}
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
