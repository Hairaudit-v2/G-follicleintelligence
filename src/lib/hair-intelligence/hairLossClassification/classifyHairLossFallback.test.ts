import test from "node:test";
import assert from "node:assert/strict";
import { hairLossClassificationNotConfiguredResult } from "./classifyHairLossFallback";

test("fallback when OpenAI missing shape", () => {
  const r = hairLossClassificationNotConfiguredResult();
  assert.equal(r.pattern_type, "unknown");
  assert.equal(r.confidence_score, 0);
  assert.equal(r.classification_system, "custom");
  assert.equal(r.classification_grade, "unknown");
  assert.ok(r.notes.includes("OPENAI_API_KEY"));
});
