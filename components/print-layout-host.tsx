"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { PrintDocument, PrintExportPayload } from "blob-editor/print";
import "blob-editor/react/blob-editor.css";

const PrintLayout = dynamic(
  () => import("blob-editor/react").then((m) => m.PrintLayout),
  { ssr: false, loading: () => <PrintSkeleton label="Loading layout…" /> },
);

const PRIMARY = "#f10ea0";
const SECONDARY = "#e95214";

type ThemeMode = "light" | "dark" | "system";

function PrintSkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-divider bg-surface p-8">
      <div className="h-64 w-48 animate-pulse rounded-[2rem] bg-badge sm:h-80 sm:w-56" />
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

export type PrintAssetInput = {
  id: string;
  label: string;
  thumbUrl: string;
  /** Full PNG URL for resolveAsset */
  fullUrl: string;
  visibility?: string;
};

export type PrintLayoutHostProps = {
  assets: PrintAssetInput[];
  document?: PrintDocument | unknown;
  onExport: (payload: PrintExportPayload) => void | Promise<void>;
  onCancel?: () => void;
};

export function PrintLayoutHost({
  assets,
  document,
  onExport,
  onCancel,
}: PrintLayoutHostProps) {
  const themeMode = useThemeMode();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrls, setBlobUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const urls = new Map<string, string>();

    void (async () => {
      try {
        setReady(false);
        setError(null);
        for (const a of assets) {
          const res = await fetch(a.fullUrl);
          if (!res.ok) throw new Error(`Failed to load ${a.label}`);
          const blob = await res.blob();
          const obj = URL.createObjectURL(blob);
          urls.set(a.id, obj);
        }
        if (!cancelled) {
          setBlobUrls(urls);
          setReady(true);
        } else {
          for (const u of urls.values()) URL.revokeObjectURL(u);
        }
      } catch {
        if (!cancelled) setError("Could not load sticker images");
      }
    })();

    return () => {
      cancelled = true;
      for (const u of urls.values()) URL.revokeObjectURL(u);
    };
  }, [assets]);

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-[1.5rem] border border-divider bg-surface p-8">
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!ready) {
    return <PrintSkeleton label="Loading stickers…" />;
  }

  return (
    <div className="relative min-h-[70vh] w-full overflow-hidden rounded-[1.5rem] border border-divider bg-surface">
      {busy ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm font-semibold">
          Saving sheet…
        </div>
      ) : null}
      <PrintLayout
        assets={assets.map((a) => ({
          id: a.id,
          label: a.label,
          thumbUrl: a.thumbUrl,
        }))}
        document={document}
        resolveAsset={async (id) => {
          const url = blobUrls.get(id);
          if (!url) return null;
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url;
          });
        }}
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
