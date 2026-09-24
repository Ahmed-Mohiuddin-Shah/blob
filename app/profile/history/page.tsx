import { ModerationHistoryList } from "@/components/moderation-history-list";
import { requireAdmin } from "@/lib/require-user";

export default async function ProfileHistoryPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Moderation history</h1>
      <p className="mt-1 text-sm text-secondary">
        Approvals, rejections, and edit requests across stickers (and later
        collections / packs / layouts).
      </p>
      <div className="mt-8">
        <ModerationHistoryList />
      </div>
    </div>
  );
}
