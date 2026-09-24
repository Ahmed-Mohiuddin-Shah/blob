/** ponytail: assert normalizeTagName ALL CAPS — fails if save casing drifts. */
import assert from "node:assert/strict";
import { normalizeTagName, tagSlug } from "../lib/stickers.ts";

assert.equal(normalizeTagName("  angry cat "), "ANGRY CAT");
assert.equal(normalizeTagName("MeMe"), "MEME");
assert.equal(tagSlug(normalizeTagName("Angry Cat")), "angry-cat");
console.log("ok: normalizeTagName");
