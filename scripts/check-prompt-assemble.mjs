/** ponytail: assembler injects description/query; no free-form placeholders. */
import assert from "node:assert/strict";
import {
  assembleSearchAgentPrompt,
  assembleStructurePrompt,
  assembleVisionJsonPrompt,
  DEFAULT_META_OUTPUT_EXAMPLE,
  DEFAULT_META_STRUCTURE,
  DEFAULT_SEARCH_AGENT,
  DEFAULT_SEARCH_OUTPUT_EXAMPLE,
} from "../lib/search/prompt-defaults.ts";

const structured = assembleStructurePrompt(
  DEFAULT_META_STRUCTURE,
  DEFAULT_META_OUTPUT_EXAMPLE,
  "a blackboard on a wall",
);
assert.ok(structured.includes("a blackboard on a wall"));
assert.ok(structured.includes("CHARACTER"));
assert.ok(!structured.includes("ANIME"));
assert.ok(!structured.includes("ANGRY"));
assert.ok(!/MEME/.test(DEFAULT_META_OUTPUT_EXAMPLE));

const visionJson = assembleVisionJsonPrompt(
  "Look at this sticker.",
  DEFAULT_META_OUTPUT_EXAMPLE,
);
assert.ok(visionJson.includes("Look at this sticker."));
assert.ok(visionJson.includes(DEFAULT_META_OUTPUT_EXAMPLE));

const agent = assembleSearchAgentPrompt(
  DEFAULT_SEARCH_AGENT,
  DEFAULT_SEARCH_OUTPUT_EXAMPLE,
  "angry cat",
);
assert.ok(agent.includes("User query: angry cat"));
assert.ok(agent.includes("hybrid"));

console.log("ok: prompt assemble");
