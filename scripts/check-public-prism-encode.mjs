/** ponytail: approved public stickers must encode onto the public PRISM. */
import assert from "node:assert/strict";

const shouldUsePublic = (visibility, moderationStatus) =>
  visibility === "public" && moderationStatus === "approved";

assert.equal(shouldUsePublic("public", "approved"), true);
assert.equal(shouldUsePublic("unlisted", "approved"), false);
assert.equal(shouldUsePublic("public", "pending"), false);
console.log("ok: public prism encode gate");
