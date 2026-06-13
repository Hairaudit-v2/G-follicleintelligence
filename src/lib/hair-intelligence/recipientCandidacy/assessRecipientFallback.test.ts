import test from "node:test";
import assert from "node:assert/strict";
import { recipientAssessmentNotConfiguredResult } from "./assessRecipientFallback";

test("fallback has zero confidence and empty topics", () => {
  const a = recipientAssessmentNotConfiguredResult("no_api_key");
  assert.equal(a.confidence_score, 0);
  assert.deepEqual(a.review_topics, []);
  assert.equal(a.recipient_quality_rating, "unknown");
  const b = recipientAssessmentNotConfiguredResult("no_image");
  assert.ok(b.ai_notes.includes("image"));
});
