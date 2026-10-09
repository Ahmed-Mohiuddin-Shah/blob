import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isHeartbeatFresh } from "@/lib/jobs/types";

describe("isHeartbeatFresh", () => {
  const prev = process.env.WORKER_ONLINE_SECONDS;

  beforeEach(() => {
    process.env.WORKER_ONLINE_SECONDS = "45";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.WORKER_ONLINE_SECONDS;
    else process.env.WORKER_ONLINE_SECONDS = prev;
  });

  it("is false when heartbeat missing", () => {
    expect(isHeartbeatFresh(null)).toBe(false);
    expect(isHeartbeatFresh(undefined)).toBe(false);
  });

  it("is true within the online window", () => {
    const now = Date.parse("2026-10-08T12:00:00.000Z");
    const hb = new Date(now - 30_000);
    expect(isHeartbeatFresh(hb, now, 45)).toBe(true);
  });

  it("is false after the online window", () => {
    const now = Date.parse("2026-10-08T12:00:00.000Z");
    const hb = new Date(now - 46_000);
    expect(isHeartbeatFresh(hb, now, 45)).toBe(false);
  });

  it("treats exact window boundary as fresh", () => {
    const now = Date.parse("2026-10-08T12:00:00.000Z");
    const hb = new Date(now - 45_000);
    expect(isHeartbeatFresh(hb, now, 45)).toBe(true);
  });
});
