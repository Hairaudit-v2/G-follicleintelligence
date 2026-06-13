import test from "node:test";
import assert from "node:assert/strict";
import { consultationChecklistFallbackResult } from "./generateChecklistFallback";

test("fallback uses low priority and empty items", () => {
  const r = consultationChecklistFallbackResult("no_api_key");
  assert.equal(r.priority_level, "low");
  assert.equal(r.confidence_score, 0);
  assert.deepEqual(r.checklist_items, []);
  assert.ok(r.ai_notes.includes("OPENAI_API_KEY"));
});
