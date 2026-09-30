"use server";

import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canManageAdmins } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import {
  LLM_PROMPT_KEY,
  loadPromptFormBodies,
  metaPromptsFromDraft,
  searchPromptsFromDraft,
  upsertLlmPrompts,
} from "@/lib/search/prompts";
import { testMetaPrompts, testSearchPrompts } from "@/lib/search/prompt-test";

export type PromptApplyState = {
  ok?: boolean;
  error?: string;
};

export type MetaTestState = {
  ok?: boolean;
  error?: string;
  prose?: string;
  result?: {
    aiCaption: string;
    aiScenario: string;
    aiVisualTags: string[];
  } | null;
  raw?: string | null;
};

export type SearchTestState = {
  ok?: boolean;
  error?: string;
  plan?: { q: string; mode: string; filter: string };
  hits?: Array<{ id?: string; title?: string; slug?: string }>;
  raw?: string;
};

async function requireSuperadminUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (
    !user ||
    !canManageAdmins({ role: user.role, accountStatus: user.accountStatus })
  ) {
    return null;
  }
  return user;
}

export async function loadAdminPromptBodies() {
  const user = await requireSuperadminUser();
  if (!user) return null;
  return loadPromptFormBodies();
}

export async function applyMetaPromptsAction(
  _prev: PromptApplyState,
  formData: FormData,
): Promise<PromptApplyState> {
  const user = await requireSuperadminUser();
  if (!user) return { error: "Forbidden" };
  try {
    await upsertLlmPrompts(
      {
        [LLM_PROMPT_KEY.metaVisionDescribe]: String(
          formData.get("visionDescribe") ?? "",
        ),
        [LLM_PROMPT_KEY.metaVisionMotion]: String(
          formData.get("visionMotion") ?? "",
        ),
        [LLM_PROMPT_KEY.metaStructure]: String(formData.get("structure") ?? ""),
        [LLM_PROMPT_KEY.metaVisionJson]: String(
          formData.get("visionJson") ?? "",
        ),
        [LLM_PROMPT_KEY.metaOutputExample]: String(
          formData.get("outputExample") ?? "",
        ),
      },
      user.id,
    );
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Apply failed",
    };
  }
}

export async function applySearchPromptsAction(
  _prev: PromptApplyState,
  formData: FormData,
): Promise<PromptApplyState> {
  const user = await requireSuperadminUser();
  if (!user) return { error: "Forbidden" };
  try {
    await upsertLlmPrompts(
      {
        [LLM_PROMPT_KEY.searchAgent]: String(formData.get("agent") ?? ""),
        [LLM_PROMPT_KEY.searchOutputExample]: String(
          formData.get("outputExample") ?? "",
        ),
      },
      user.id,
    );
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Apply failed",
    };
  }
}

export async function testMetaPromptAction(
  _prev: MetaTestState,
  formData: FormData,
): Promise<MetaTestState> {
  const user = await requireSuperadminUser();
  if (!user) return { error: "Forbidden" };

  // Client sends resized JPEG base64 (fileToHandoff) — not the raw wallpaper.
  const photoData = String(formData.get("photoData") ?? "").trim();
  if (!photoData) {
    return { error: "Choose a photo to test" };
  }
  // ~1MB raw base64 ≈ 750KB decoded; vision handoff is far smaller.
  if (photoData.length > 1_200_000) {
    return { error: "Resized image still too large — try a smaller photo" };
  }

  const prompts = metaPromptsFromDraft({
    visionDescribe: String(formData.get("visionDescribe") ?? ""),
    visionMotion: String(formData.get("visionMotion") ?? ""),
    structure: String(formData.get("structure") ?? ""),
    visionJson: String(formData.get("visionJson") ?? ""),
    outputExample: String(formData.get("outputExample") ?? ""),
  });

  try {
    const buf = Buffer.from(photoData, "base64");
    if (!buf.length) return { error: "Invalid photo data" };
    const out = await testMetaPrompts(prompts, buf);
    if (out.error) return { error: out.error, prose: out.prose };
    return {
      ok: true,
      prose: out.prose,
      result: out.result,
      raw: out.raw,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Test failed",
    };
  }
}

export async function testSearchPromptAction(
  _prev: SearchTestState,
  formData: FormData,
): Promise<SearchTestState> {
  const user = await requireSuperadminUser();
  if (!user) return { error: "Forbidden" };

  const q = String(formData.get("q") ?? "").trim();
  if (!q) return { error: "Enter a search query to test" };

  const prompts = searchPromptsFromDraft({
    agent: String(formData.get("agent") ?? ""),
    outputExample: String(formData.get("outputExample") ?? ""),
  });

  try {
    const out = await testSearchPrompts(prompts, q);
    if (out.error) return { error: out.error, raw: out.raw };
    return {
      ok: true,
      plan: out.plan,
      hits: out.hits,
      raw: out.raw,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Test failed",
    };
  }
}
