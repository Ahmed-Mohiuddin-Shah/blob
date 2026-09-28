/** ponytail: assert Ollama sampling caps + repeat-limit detection. */
import assert from "node:assert/strict";
import {
  isOllamaRepeatLimitError,
  ollamaChatOptions,
} from "../lib/ollama/client.ts";

const describe = ollamaChatOptions("describe");
assert.ok((describe.numPredict ?? 0) <= 220);
assert.ok((describe.repeatPenalty ?? 0) >= 1.3);

const json = ollamaChatOptions("json");
assert.ok((json.numPredict ?? 0) <= 320);
assert.ok((json.repeatPenalty ?? 0) >= 1.35);

assert.equal(
  isOllamaRepeatLimitError(
    new Error(
      'Ollama chat 500: {"error":"prediction aborted, token repeat limit reached"}',
    ),
  ),
  true,
);
assert.equal(isOllamaRepeatLimitError(new Error("timeout")), false);
console.log("ok: ollama chat options");
