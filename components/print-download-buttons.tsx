"use client";

import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { glassPublicObjectUrl } from "@/lib/glass";
import { BusyButton } from "./busy-button";

type Props = {
  /** Entity id for proxy URLs */
  id: string;
  slug: string;
  kind: "sheets" | "packs";
  pngGlassObjectId: string | null;
  pdfGlassObjectId: string | null;
  ready: boolean;
};

export function PrintDownloadButtons({
  id,
  slug,
  kind,
  pngGlassObjectId,
  pdfGlassObjectId,
  ready,
}: Props) {
  const [busy, setBusy] = useState<"png" | "pdf" | "print" | null>(null);
  if (!ready) return null;

  const useGlass = !!(pngGlassObjectId && pdfGlassObjectId);
  const pngHref = useGlass
    ? glassPublicObjectUrl(pngGlassObjectId!)
    : `/api/${kind}/${id}/media/png`;
  const pdfHref = useGlass
    ? glassPublicObjectUrl(pdfGlassObjectId!)
    : `/api/${kind}/${id}/media/pdf`;

  async function printPdf() {
    setBusy("print");
    try {
      const res = await fetch(`/api/${kind}/${id}/media/pdf`);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) {
        w.addEventListener("load", () => {
          w.focus();
          w.print();
        });
      } else {
        // popup blocked — open as download
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slug}.pdf`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
        Downloads
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        <li>
          <a
            href={pdfHref}
            download={`${slug}.pdf`}
            target={useGlass ? "_blank" : undefined}
            rel={useGlass ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface px-4 py-2 text-xs font-semibold transition hover:border-accent-pink/40"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-gradient text-white">
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            PDF
          </a>
        </li>
        <li>
          <a
            href={pngHref}
            download={`${slug}.png`}
            target={useGlass ? "_blank" : undefined}
            rel={useGlass ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface px-4 py-2 text-xs font-semibold transition hover:border-accent-pink/40"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-gradient text-white">
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            PNG
          </a>
        </li>
        <li>
          <BusyButton
            type="button"
            busy={busy === "print"}
            onClick={() => void printPdf()}
            className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface px-4 py-2 text-xs font-semibold transition hover:border-accent-pink/40"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-gradient text-white">
              <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            Print
          </BusyButton>
        </li>
      </ul>
    </div>
  );
}
