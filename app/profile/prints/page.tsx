import { PrintsLibrary } from "@/components/prints-library";
import { requireSessionUser } from "@/lib/require-user";

export default async function ProfilePrintsPage() {
  await requireSessionUser();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Your prints</h1>
      <p className="mt-1 text-sm text-secondary">
        Sticker sheets and packs you&apos;ve created — including ones still
        generating.
      </p>
      <div className="mt-8">
        <PrintsLibrary signedIn mine />
      </div>
    </div>
  );
}
