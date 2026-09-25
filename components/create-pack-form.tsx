"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MIN_PACK_SHEETS } from "@/lib/prints";
import { BusyButton } from "./busy-button";

type SheetOpt = {
  id: string;
  name: string;
  slug: string;
  previewUrl: string | null;
  status: string;
};

type PackOpt = {
  id: string;
  name: string;
  slug: string;
  sheetCount?: number;
};

type Props = {
  initialSheetIds?: string[];
  initialPackIds?: string[];
};

type ExistingPack = { slug: string; name: string };

export function CreatePackForm({
  initialSheetIds = [],
  initialPackIds = [],
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sheets, setSheets] = useState<SheetOpt[]>([]);
  const [packs, setPacks] = useState<PackOpt[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(
    () => new Set(initialSheetIds),
  );
  const [selectedPacks, setSelectedPacks] = useState<Set<string>>(
    () => new Set(initialPackIds),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingPack, setExistingPack] = useState<ExistingPack | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([
        fetch("/api/sheets"),
        fetch("/api/packs"),
      ]);
      const sJson = (await sRes.json()) as { items: SheetOpt[] };
      const pJson = (await pRes.json()) as { items: PackOpt[] };
      setSheets(sJson.items ?? []);
      setPacks(pJson.items ?? []);
    } catch {
      setError("Could not load sheets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSheet(id: string) {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePack(id: string) {
    setSelectedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setExistingPack(null);
    try {
      const res = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sheetIds: [...selectedSheets],
          packIds: [...selectedPacks],
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
        name?: string;
      };
      if (res.status === 409 && json.slug) {
        setExistingPack({
          slug: json.slug,
          name: json.name ?? "Existing pack",
        });
        return;
      }
      if (!res.ok) {
        setError(json.error ?? "Could not create pack");
        return;
      }
      router.push(`/prints/packs/${json.slug}`);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    name.trim().length > 0 &&
    (selectedSheets.size + selectedPacks.size > 0);

  return (
    <div className="space-y-8">
      <label className="block max-w-md">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          Pack name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          className="mt-1 w-full rounded-full border border-divider bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent-pink"
          placeholder="My sticker pack"
        />
      </label>

      <p className="text-sm text-secondary">
        Pick at least {MIN_PACK_SHEETS} sheets (directly or by including packs —
        packs expand to their sheet references).
      </p>

      {loading ? (
        <p className="text-sm text-secondary">Loading…</p>
      ) : (
        <>
          <section>
            <h2 className="text-lg font-semibold">Sheets</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {sheets.map((s) => {
                const on = selectedSheets.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSheet(s.id)}
                    className={`overflow-hidden rounded-[1.5rem] border-2 text-left transition ${
                      on ? "border-accent-pink" : "border-divider"
                    }`}
                  >
                    <div className="aspect-[3/4] bg-badge">
                      {s.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.previewUrl}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : null}
                    </div>
                    <p className="truncate px-3 py-2 text-sm font-semibold">
                      {s.name}
                    </p>
                  </button>
                );
              })}
            </div>
            {!sheets.length ? (
              <p className="mt-2 text-sm text-secondary">
                No ready sheets yet.{" "}
                <a href="/prints/sheets/new" className="text-accent-pink hover:underline">
                  Create one
                </a>
                .
              </p>
            ) : null}
          </section>

          {packs.length > 0 ? (
            <section>
              <h2 className="text-lg font-semibold">Combine from packs</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {packs.map((p) => {
                  const on = selectedPacks.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePack(p.id)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        on
                          ? "bg-accent-gradient text-white"
                          : "border border-divider bg-surface"
                      }`}
                    >
                      {p.name}
                      {p.sheetCount != null ? ` (${p.sheetCount})` : ""}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}

      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}

      <BusyButton
        type="button"
        busy={busy}
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="rounded-full bg-accent-gradient px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        Create pack
      </BusyButton>

      {mounted && existingPack
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pack-exists-title"
            >
              <div className="w-full max-w-md rounded-[1.5rem] border border-divider bg-surface p-6 shadow-2xl">
                <p
                  id="pack-exists-title"
                  className="text-xs font-bold uppercase tracking-[0.18em] text-accent-orange"
                >
                  Pack already exists
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {existingPack.name}
                </h2>
                <p className="mt-2 text-sm text-secondary">
                  A pack with this combination of sheets already exists. Open it,
                  or stay here and change your selection.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <BusyButton
                    type="button"
                    busy={false}
                    onClick={() =>
                      router.push(`/prints/packs/${existingPack.slug}`)
                    }
                    className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    View pack
                  </BusyButton>
                  <button
                    type="button"
                    onClick={() => setExistingPack(null)}
                    className="rounded-full border border-divider px-5 py-2.5 text-sm font-semibold text-secondary"
                  >
                    Stay here
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
