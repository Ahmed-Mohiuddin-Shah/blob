import { describe, expect, it } from "vitest";
import { hashWorkerKey } from "@/lib/jobs/auth";
import {
  idempotencyKey,
  JOB_TYPE,
  leaseSeconds,
} from "@/lib/jobs/types";

describe("jobs helpers", () => {
  it("idempotencyKey is stable per type+subject", () => {
    expect(idempotencyKey(JOB_TYPE.compositionEncode, BigInt(42))).toBe(
      "composition_encode:42",
    );
    expect(idempotencyKey(JOB_TYPE.sheetEncode, BigInt(7))).toBe(
      "sheet_encode:7",
    );
  });

  it("hashWorkerKey is sha256 hex", () => {
    const h = hashWorkerKey("blob_wk_test");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(hashWorkerKey("blob_wk_test")).toBe(h);
    expect(hashWorkerKey("other")).not.toBe(h);
  });

  it("leaseSeconds falls back to 120", () => {
    const prev = process.env.WORKER_LEASE_SECONDS;
    delete process.env.WORKER_LEASE_SECONDS;
    expect(leaseSeconds()).toBe(120);
    process.env.WORKER_LEASE_SECONDS = "90";
    expect(leaseSeconds()).toBe(90);
    if (prev === undefined) delete process.env.WORKER_LEASE_SECONDS;
    else process.env.WORKER_LEASE_SECONDS = prev;
  });
});
