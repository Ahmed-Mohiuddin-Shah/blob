"use client";

import { useActionState } from "react";
import {
  createWorkerKeyAction,
  pingWorkerAction,
  revokeWorkerKeyAction,
  type HealthPingState,
  type WorkerKeyActionState,
} from "@/app/actions/admin-workers";
import { BusyButton } from "./busy-button";

export type WorkerActiveJob = {
  jobId: string;
  type: string;
  subjectType: string;
  subjectId: string;
  title: string;
};

export type WorkerRow = {
  id: string;
  instanceId: string;
  version: string;
  capabilities: string[];
  concurrency: number;
  cpuPct: number | null;
  memMb: number | null;
  status: string;
  lastHeartbeatAt: string | null;
  keyName: string;
  keyPrefix: string;
  activeJobs: WorkerActiveJob[];
};

export type WorkerKeyRow = {
  id: string;
  name: string;
  prefix: string;
  revokedAt: string | null;
  createdAt: string;
};

const keyInitial: WorkerKeyActionState = {};
const pingInitial: HealthPingState = {};

function CreateKeyForm() {
  const [state, action, pending] = useActionState(
    createWorkerKeyAction,
    keyInitial,
  );

  return (
    <div className="rounded-[28px] bg-surface p-5 ring-1 ring-divider">
      <h2 className="text-sm font-bold uppercase tracking-wider text-inactive">
        Create worker key
      </h2>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="text-secondary">Name</span>
          <input
            name="name"
            required
            placeholder="studio-gpu-1"
            className="mt-1 block w-56 rounded-xl border border-divider bg-background px-3 py-2 text-sm"
          />
        </label>
        <BusyButton
          type="submit"
          busy={pending}
          className="rounded-full bg-accent-gradient px-4 py-2 text-sm font-semibold text-white"
        >
          Create
        </BusyButton>
      </form>
      {state.error ? (
        <p className="mt-2 text-sm text-red-500">{state.error}</p>
      ) : null}
      {state.secret ? (
        <div className="mt-4 rounded-2xl bg-background p-4 ring-1 ring-accent-pink/30">
          <p className="text-xs font-bold uppercase tracking-wider text-inactive">
            Copy now — shown once
          </p>
          <code className="mt-2 block break-all text-sm text-foreground">
            {state.secret}
          </code>
          <p className="mt-2 text-xs text-secondary">
            Set as <code>WORKER_API_KEY</code> on the worker host.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function RevokeKeyForm({ keyId }: { keyId: string }) {
  const [state, action, pending] = useActionState(
    revokeWorkerKeyAction,
    keyInitial,
  );
  return (
    <form action={action}>
      <input type="hidden" name="keyId" value={keyId} />
      <BusyButton
        type="submit"
        busy={pending}
        className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 ring-1 ring-red-500/40"
      >
        Revoke
      </BusyButton>
      {state.error ? (
        <span className="ml-2 text-xs text-red-500">{state.error}</span>
      ) : null}
    </form>
  );
}

function PingForm({ workerId }: { workerId: string }) {
  const [state, action, pending] = useActionState(
    pingWorkerAction,
    pingInitial,
  );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="workerId" value={workerId} />
      <BusyButton
        type="submit"
        busy={pending}
        className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-divider"
      >
        Health check
      </BusyButton>
      {state.ok ? (
        <span
          className={`text-xs font-semibold ${state.alive ? "text-emerald-500" : "text-red-500"}`}
        >
          {state.alive ? "pong" : "no reply"}
        </span>
      ) : null}
      {state.error ? (
        <span className="text-xs text-red-500">{state.error}</span>
      ) : null}
    </form>
  );
}

export function WorkersAdmin({
  workers,
  keys,
  isSuperadmin,
}: {
  workers: WorkerRow[];
  keys: WorkerKeyRow[];
  isSuperadmin: boolean;
}) {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-inactive">
          Fleet
        </h2>
        {workers.length === 0 ? (
          <p className="mt-3 text-sm text-secondary">No workers registered yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-divider rounded-[28px] bg-surface ring-1 ring-divider">
            {workers.map((w) => (
              <li
                key={w.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    <span
                      className={`mr-2 inline-block h-2 w-2 rounded-full ${
                        w.status === "online" ? "bg-emerald-500" : "bg-inactive"
                      }`}
                    />
                    {w.instanceId}
                  </p>
                  <p className="truncate text-xs text-secondary">
                    {w.keyName} · {w.keyPrefix}… · v{w.version} ·{" "}
                    {w.capabilities.join(", ") || "—"}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    concurrency {w.concurrency}
                    {w.cpuPct != null ? ` · cpu ~${w.cpuPct.toFixed(0)}%` : ""}
                    {w.memMb != null ? ` · mem ${Math.round(w.memMb)} MB` : ""}
                    {w.lastHeartbeatAt
                      ? ` · last ${new Date(w.lastHeartbeatAt).toLocaleString()}`
                      : ""}
                  </p>
                  {w.activeJobs.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {w.activeJobs.map((j) => (
                        <li
                          key={j.jobId}
                          className="truncate text-xs font-semibold text-foreground"
                        >
                          <span className="text-accent-pink">processing</span>
                          {" · "}
                          {j.type.replace(/_/g, " ")}
                          {" · "}
                          {j.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-inactive">idle</p>
                  )}
                </div>
                {isSuperadmin && w.status === "online" ? (
                  <PingForm workerId={w.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isSuperadmin ? (
        <>
          <CreateKeyForm />
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-inactive">
              API keys
            </h2>
            {keys.length === 0 ? (
              <p className="mt-3 text-sm text-secondary">No keys yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-divider rounded-[28px] bg-surface ring-1 ring-divider">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{k.name}</p>
                      <p className="text-xs text-secondary">
                        {k.prefix}… ·{" "}
                        {k.revokedAt
                          ? `revoked ${new Date(k.revokedAt).toLocaleString()}`
                          : `created ${new Date(k.createdAt).toLocaleString()}`}
                      </p>
                    </div>
                    {!k.revokedAt ? <RevokeKeyForm keyId={k.id} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
