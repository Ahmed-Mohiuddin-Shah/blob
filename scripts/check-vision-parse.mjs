/** ponytail: JSON fence strip + placeholder caption rejection. */
import assert from "node:assert/strict";
import {
  extractJsonObject,
  parseVisionEnrichResult,
} from "../lib/search/vision-parse.ts";

assert.equal(
  extractJsonObject('```json\n{"a":1,}\n```'),
  '{"a":1}',
);

assert.throws(() =>
  parseVisionEnrichResult(
    '{"caption":"<a character holding balloons>","scenario":"x","tags":["HAPPY"]}',
  ),
);

const ok = parseVisionEnrichResult(
  '```json\n{"caption":"blue cat rain","scenario":"weather","tags":["CAT","RAIN","CLOUD"],}\n```',
);
assert.equal(ok.aiCaption, "blue cat rain");
assert.deepEqual(ok.aiVisualTags, ["CAT", "RAIN", "CLOUD"]);

console.log("ok: vision parse");
