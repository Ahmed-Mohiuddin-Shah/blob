/**
 * Single-flight local encode fallback when no capable remote worker is online.
 * Concurrency is hard-coded to 1 — never overlap canvas/FFmpeg on the app host.
 */

type Task = () => Promise<void>;

type QueueState = {
  chain: Promise<void>;
  depth: number;
};

function queue(): QueueState {
  const g = globalThis as unknown as { __blobLocalJobQueue?: QueueState };
  if (!g.__blobLocalJobQueue) {
    g.__blobLocalJobQueue = { chain: Promise.resolve(), depth: 0 };
  }
  return g.__blobLocalJobQueue;
}

/** Enqueue work behind a process-wide mutex (concurrency 1). */
export function enqueueLocal(task: Task): void {
  const q = queue();
  q.depth += 1;
  q.chain = q.chain
    .then(async () => {
      try {
        await task();
      } catch (err) {
        console.error("Local job fallback failed:", err);
      } finally {
        q.depth -= 1;
      }
    })
    .catch(() => {
      /* keep chain alive */
    });
}

export function localQueueDepth(): number {
  return queue().depth;
}
