"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  applyMetaPromptsAction,
  applySearchPromptsAction,
  testMetaPromptAction,
  testSearchPromptAction,
  type MetaTestState,
  type PromptApplyState,
  type SearchTestState,
} from "@/app/actions/admin-prompts";
import { BusyButton } from "./busy-button";
import { fileToHandoff } from "@/lib/search/image-handoff";
import { LLM_PROMPT_KEY, type LlmPromptKey } from "@/lib/search/prompt-defaults";

type Bodies = Record<LlmPromptKey, string>;

const initialApply: PromptApplyState = {};
const initialMetaTest: MetaTestState = {};
const initialSearchTest: SearchTestState = {};

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-divider bg-badge px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-secondary">
      {label}
    </span>
  );
}

function TextArea({
  label,
  hint,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-inactive">
        {label}
      </span>
      {hint ? <p className="mt-0.5 text-xs text-secondary">{hint}</p> : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-2 w-full rounded-2xl border border-divider bg-background px-4 py-3 font-mono text-sm leading-relaxed text-foreground outline-none focus:border-accent-pink/50"
      />
    </label>
  );
}

/** Superadmin: tune search-metadata + search-agent prompts with Test / Apply. */
export function PromptsAdmin({ initial }: { initial: Bodies }) {
  const [metaApply, metaApplyAction, metaApplyPending] = useActionState(
    applyMetaPromptsAction,
    initialApply,
  );
  const [searchApply, searchApplyAction, searchApplyPending] = useActionState(
    applySearchPromptsAction,
    initialApply,
  );
  const [searchTest, searchTestAction, searchTestPending] = useActionState(
    testSearchPromptAction,
    initialSearchTest,
  );

  const [visionDescribe, setVisionDescribe] = useState(
    initial[LLM_PROMPT_KEY.metaVisionDescribe],
  );
  const [visionMotion, setVisionMotion] = useState(
    initial[LLM_PROMPT_KEY.metaVisionMotion],
  );
  const [structure, setStructure] = useState(
    initial[LLM_PROMPT_KEY.metaStructure],
  );
  const [visionJson, setVisionJson] = useState(
    initial[LLM_PROMPT_KEY.metaVisionJson],
  );
  const [metaOutput, setMetaOutput] = useState(
    initial[LLM_PROMPT_KEY.metaOutputExample],
  );
  const [agent, setAgent] = useState(initial[LLM_PROMPT_KEY.searchAgent]);
  const [searchOutput, setSearchOutput] = useState(
    initial[LLM_PROMPT_KEY.searchOutputExample],
  );
  const [metaTest, setMetaTest] = useState<MetaTestState>(initialMetaTest);
  const [metaTestBusy, setMetaTestBusy] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const metaHidden = (
    <>
      <input type="hidden" name="visionDescribe" value={visionDescribe} />
      <input type="hidden" name="visionMotion" value={visionMotion} />
      <input type="hidden" name="structure" value={structure} />
      <input type="hidden" name="visionJson" value={visionJson} />
      <input type="hidden" name="outputExample" value={metaOutput} />
    </>
  );

  async function runMetaTest() {
    if (!photoFile) {
      setMetaTest({ error: "Choose a photo to test" });
      return;
    }
    setMetaTestBusy(true);
    setMetaTest({});
    try {
      const handoff = await fileToHandoff(photoFile);
      const fd = new FormData();
      fd.set("visionDescribe", visionDescribe);
      fd.set("visionMotion", visionMotion);
      fd.set("structure", structure);
      fd.set("visionJson", visionJson);
      fd.set("outputExample", metaOutput);
      fd.set("photoData", handoff.data);
      fd.set("photoMime", handoff.mime);
      const result = await testMetaPromptAction({}, fd);
      setMetaTest(result);
    } catch (err) {
      setMetaTest({
        error: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setMetaTestBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-divider bg-surface p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-pink">
          Search metadata
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          Enrich prompts
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Tune vision describe, structure, and output shape. Dynamic slots are
          injected for you — do not invent placeholders.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="description" />
          <Chip label="output example" />
          <Chip label="image" />
        </div>

        <div className="mt-6 space-y-4">
          <TextArea
            label="Vision describe"
            hint="Plain instructions for pass 1 (image → prose)."
            value={visionDescribe}
            onChange={setVisionDescribe}
            rows={3}
          />
          <TextArea
            label="Vision motion (storyboard)"
            hint="GIF/video 2×3 grid. Remind the model corner 1–6 are sequence markers only."
            value={visionMotion}
            onChange={setVisionMotion}
            rows={5}
          />
          <TextArea
            label="Structure instructions"
            hint="Pass 2 (prose → JSON). System appends output example and the description."
            value={structure}
            onChange={setStructure}
            rows={8}
          />
          <TextArea
            label="From-image instructions"
            hint="VL fallback (image → JSON). System appends output example and attaches the image."
            value={visionJson}
            onChange={setVisionJson}
            rows={8}
          />
          <TextArea
            label="Output example JSON"
            hint="Shape the model should follow. Avoid sticky example tags the model will echo."
            value={metaOutput}
            onChange={setMetaOutput}
            rows={3}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-inactive">
              Test photo
            </span>
            <p className="mt-0.5 text-xs text-secondary">
              Sent as 512px JPEG — wallpapers are fine.
            </p>
            <input
              type="file"
              accept="image/*"
              className="mt-2 block w-full text-sm text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-accent-gradient file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              onChange={(e) => {
                setPhotoFile(e.target.files?.[0] ?? null);
                setMetaTest({});
              }}
            />
          </label>
          <BusyButton
            type="button"
            busy={metaTestBusy}
            disabled={metaTestBusy || !photoFile}
            onClick={() => void runMetaTest()}
            className="rounded-full border border-divider bg-background px-5 py-2.5 text-sm font-semibold hover:border-accent-pink/40"
          >
            Test prompt
          </BusyButton>
        </div>

        <form action={metaApplyAction} className="mt-3">
          {metaHidden}
          <BusyButton
            type="submit"
            busy={metaApplyPending}
            className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
          >
            Apply prompt
          </BusyButton>
          {metaApply.ok ? (
            <span className="ml-3 text-sm text-secondary">Saved.</span>
          ) : null}
          {metaApply.error ? (
            <p className="mt-2 text-sm text-metro-pink">{metaApply.error}</p>
          ) : null}
        </form>

        {(metaTest.ok || metaTest.error) && (
          <div className="mt-6 rounded-2xl border border-divider bg-background p-4 text-sm">
            {metaTest.error ? (
              <p className="text-metro-pink">{metaTest.error}</p>
            ) : null}
            {metaTest.prose ? (
              <div className="mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-inactive">
                  Vision prose
                </p>
                <p className="mt-1 text-secondary">{metaTest.prose}</p>
              </div>
            ) : null}
            {metaTest.result ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-inactive">
                  Parsed result
                </p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-foreground">
                  {JSON.stringify(metaTest.result, null, 2)}
                </pre>
              </div>
            ) : null}
            {metaTest.raw ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-inactive">
                  Raw model
                </summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-secondary">
                  {metaTest.raw}
                </pre>
              </details>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-divider bg-surface p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-orange">
          Search agent
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          Query planner
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Tune how the agent rewrites user queries into Meili plans. System
          injects the query and the output example.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="query" />
          <Chip label="output example" />
        </div>

        <div className="mt-6 space-y-4">
          <TextArea
            label="Agent instructions"
            value={agent}
            onChange={setAgent}
            rows={4}
          />
          <TextArea
            label="Output example JSON"
            value={searchOutput}
            onChange={setSearchOutput}
            rows={3}
          />
        </div>

        <form
          action={searchTestAction}
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="agent" value={agent} />
          <input type="hidden" name="outputExample" value={searchOutput} />
          <label className="block flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-inactive">
              Test search
            </span>
            <input
              type="text"
              name="q"
              required
              placeholder="angry cat reaction"
              className="mt-2 w-full rounded-full border border-divider bg-background px-4 py-2.5 text-sm outline-none focus:border-accent-pink/50"
            />
          </label>
          <BusyButton
            type="submit"
            busy={searchTestPending}
            className="rounded-full border border-divider bg-background px-5 py-2.5 text-sm font-semibold hover:border-accent-pink/40"
          >
            Test prompt
          </BusyButton>
        </form>

        <form action={searchApplyAction} className="mt-3">
          <input type="hidden" name="agent" value={agent} />
          <input type="hidden" name="outputExample" value={searchOutput} />
          <BusyButton
            type="submit"
            busy={searchApplyPending}
            className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
          >
            Apply prompt
          </BusyButton>
          {searchApply.ok ? (
            <span className="ml-3 text-sm text-secondary">Saved.</span>
          ) : null}
          {searchApply.error ? (
            <p className="mt-2 text-sm text-metro-pink">{searchApply.error}</p>
          ) : null}
        </form>

        {(searchTest.ok || searchTest.error) && (
          <div className="mt-6 rounded-2xl border border-divider bg-background p-4 text-sm">
            {searchTest.error ? (
              <p className="text-metro-pink">{searchTest.error}</p>
            ) : null}
            {searchTest.plan ? (
              <div className="mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-inactive">
                  Plan
                </p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-xs">
                  {JSON.stringify(searchTest.plan, null, 2)}
                </pre>
              </div>
            ) : null}
            {searchTest.hits?.length ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-inactive">
                  Hits ({searchTest.hits.length})
                </p>
                <ul className="mt-1 list-inside list-disc text-secondary">
                  {searchTest.hits.map((h) => (
                    <li key={h.id ?? h.slug}>{h.title ?? h.slug ?? h.id}</li>
                  ))}
                </ul>
              </div>
            ) : searchTest.ok ? (
              <p className="text-secondary">No hits.</p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
