import test from "node:test";
import assert from "node:assert/strict";
import { donorAssessmentNotConfiguredResult } from "./assessDonorFallback";

test("donorAssessmentNotConfiguredResult no api key", () => {
  const r = donorAssessmentNotConfiguredResult("no_api_key");
  assert.equal(r.donor_quality_rating, "unknown");
  assert.equal(r.confidence_score, 0);
  assert.ok(r.ai_notes.includes("OPENAI_API_KEY"));
});

test("donorAssessmentNotConfiguredResult no image", () => {
  const r = donorAssessmentNotConfiguredResult("no_image");
  assert.equal(r.donor_region, "unknown");
  assert.ok(r.ai_notes.includes("No donor image"));
});
