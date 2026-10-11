// Run with `npm test` (Node >= 22.18 strips the TypeScript types in utils.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeHttpsUrl } from "./utils.ts";

test("accepts https URLs", () => {
  assert.equal(isSafeHttpsUrl("https://agentstatus.dev/r/abc"), true);
});

test("rejects non-https schemes, junk and non-strings", () => {
  for (const bad of [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://agentstatus.dev",
    "//agentstatus.dev",
    "agentstatus.dev",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(isSafeHttpsUrl(bad), false, String(bad));
  }
});
