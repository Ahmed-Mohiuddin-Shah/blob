import { UnlinkedBlobbersAdmin } from "@/components/unlinked-blobbers-admin";
import { requireAdmin } from "@/lib/require-user";

export default async function UnlinkedBlobbersPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Unlinked Blobbers</h1>
      <p className="mt-1 text-sm text-secondary">
        Search and directly edit unlinked credit profiles (full CMS: name, bio,
        images, sections, social links). No change request — actions are recorded
        in history.
      </p>
      <div className="mt-8">
        <UnlinkedBlobbersAdmin />
      </div>
    </div>
  );
}
