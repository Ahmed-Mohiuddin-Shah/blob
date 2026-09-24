"use client";

import { useActionState } from "react";
import {
  updateAdminUser,
  type AdminUserActionState,
} from "@/app/actions/admin-users";
import {
  assignableRoles,
  canEditAccountStatus,
} from "@/lib/capabilities";
import { BusyButton } from "./busy-button";

const STATUSES = ["active", "pending", "suspended", "banned"] as const;
const initial: AdminUserActionState = {};

export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  accountStatus: string;
};

export type AdminUsersActor = {
  id: string;
  role: string;
  accountStatus: string;
};

function UserRowForm({
  user,
  actor,
}: {
  user: AdminUserRow;
  actor: AdminUsersActor;
}) {
  const [state, action, pending] = useActionState(updateAdminUser, initial);
  const roles = assignableRoles(actor, user);
  const statusEditable = canEditAccountStatus(actor, user);
  const roleEditable = roles.length > 0;

  return (
    <form
      action={action}
      className="flex flex-col gap-3 border-b border-divider py-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <input type="hidden" name="userId" value={user.id} />
      {!roleEditable ? (
        <input type="hidden" name="role" value={user.role} />
      ) : null}
      {!statusEditable ? (
        <input type="hidden" name="accountStatus" value={user.accountStatus} />
      ) : null}
      <div className="min-w-0">
        <p className="truncate font-semibold">{user.displayName}</p>
        <p className="truncate text-xs text-secondary">
          @{user.username} · {user.email}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="text-secondary">Role</span>
          {roleEditable ? (
            <select
              name="role"
              defaultValue={user.role}
              className="mt-1 block rounded-xl border border-divider bg-surface px-3 py-2 text-sm"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 rounded-xl border border-divider bg-surface px-3 py-2 text-sm">
              {user.role}
            </p>
          )}
        </label>
        <label className="text-xs">
          <span className="text-secondary">Status</span>
          {statusEditable ? (
            <select
              name="accountStatus"
              defaultValue={user.accountStatus}
              className="mt-1 block rounded-xl border border-divider bg-surface px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 rounded-xl border border-divider bg-surface px-3 py-2 text-sm">
              {user.accountStatus}
            </p>
          )}
        </label>
        <BusyButton
          type="submit"
          busy={pending}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-105"
        >
          Save
        </BusyButton>
      </div>
      {state.error ? (
        <p className="w-full text-sm text-accent-orange" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="w-full text-xs text-secondary" role="status">
          Updated
        </p>
      ) : null}
    </form>
  );
}

export function AdminUsersTable({
  users,
  actor,
}: {
  users: AdminUserRow[];
  actor: AdminUsersActor;
}) {
  if (users.length === 0) {
    return <p className="text-sm text-secondary">No users yet.</p>;
  }
  return (
    <div>
      {users.map((u) => (
        <UserRowForm key={u.id} user={u} actor={actor} />
      ))}
    </div>
  );
}
