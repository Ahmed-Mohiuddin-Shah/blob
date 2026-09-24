import { ProfileEditForm } from "@/components/profile-edit-form";
import { requireSessionUser } from "@/lib/require-user";

export default async function ProfileSettingsPage() {
  const { user } = await requireSessionUser();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-secondary">
        Only your local BLOB username is editable. Name and email sync from
        login.
      </p>
      <dl className="mt-8 max-w-md space-y-3 border-t border-divider pt-6 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-secondary">Display name</dt>
          <dd className="font-medium">{user.displayName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-secondary">Email</dt>
          <dd className="truncate font-medium">{user.email}</dd>
        </div>
      </dl>
      <ProfileEditForm username={user.username} />
    </div>
  );
}
