/** Browser helper: one-shot search over /api/search/ws with live steps. */

export type SearchWsStep = { type: "step"; label: string };
export type SearchWsResult = {
  type: "result";
  mode?: string;
  engine?: string;
  hits?: unknown[];
  facetDistribution?: Record<string, Record<string, number>>;
  plan?: { q: string; mode: string; filter: string };
  usedTools?: boolean;
  planFallback?: boolean;
  usedVisual?: boolean;
  processedImage?: string;
  agentSkipped?: boolean;
};
export type SearchWsError = { type: "error"; message: string };

function wsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/search/ws`;
}

export function runSearchOverWs(opts: {
  mode: "visual" | "agent";
  q?: string;
  media?: { mime: string; data: string } | null;
  onStep: (label: string) => void;
  signal?: AbortSignal;
}): Promise<SearchWsResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(wsUrl());

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        /* */
      }
      reject(new Error(message));
    };

    const ok = (result: SearchWsResult) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        /* */
      }
      resolve(result);
    };

    const onAbort = () => fail("aborted");
    opts.signal?.addEventListener("abort", onAbort);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "search",
          mode: opts.mode,
          q: opts.q ?? "",
          ...(opts.media
            ? { media: { mime: opts.media.mime, data: opts.media.data } }
            : {}),
        }),
      );
    };

    ws.onmessage = (ev) => {
      let msg: SearchWsStep | SearchWsResult | SearchWsError | { type: string };
      try {
        msg = JSON.parse(String(ev.data)) as typeof msg;
      } catch {
        return;
      }
      if (msg.type === "step" && "label" in msg) {
        opts.onStep(String((msg as SearchWsStep).label));
        return;
      }
      if (msg.type === "result") {
        ok(msg as SearchWsResult);
        return;
      }
      if (msg.type === "error") {
        fail((msg as SearchWsError).message || "Search failed");
      }
    };

    ws.onerror = () => fail("WebSocket error");
    ws.onclose = () => {
      opts.signal?.removeEventListener("abort", onAbort);
      if (!settled) fail("connection closed");
    };
  });
}
