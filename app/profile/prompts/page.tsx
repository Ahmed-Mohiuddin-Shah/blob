import { PromptsAdmin } from "@/components/prompts-admin";
import { requireSuperadmin } from "@/lib/require-user";
import { loadPromptFormBodies } from "@/lib/search/prompts";

export default async function ProfilePromptsPage() {
  await requireSuperadmin();
  const bodies = await loadPromptFormBodies();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
      <p className="mt-1 text-sm text-secondary">
        Fine-tune search metadata enrich and search-agent wording. Test with a
        photo or query before applying — workers pick up applied prompts on the
        next enrich job.
      </p>
      <div className="mt-8">
        <PromptsAdmin initial={bodies} />
      </div>
    </div>
  );
}
