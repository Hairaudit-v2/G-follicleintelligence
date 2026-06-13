import test from "node:test";
import assert from "node:assert/strict";
import { clampRecipientConfidence, normalizeHieRecipientQualityRating, normalizeHieRecipientRiskLevel } from "./enumValidation";

test("clampRecipientConfidence", () => {
  assert.equal(clampRecipientConfidence(1.2), 1);
  assert.equal(clampRecipientConfidence(-0.1), 0);
  assert.equal(clampRecipientConfidence("x"), 0);
});

test("normalize recipient enums", () => {
  assert.equal(normalizeHieRecipientQualityRating("MODERATE"), "moderate");
  assert.equal(normalizeHieRecipientQualityRating("nope"), "unknown");
  assert.equal(normalizeHieRecipientRiskLevel("HIGH"), "high");
  assert.equal(normalizeHieRecipientRiskLevel(null), null);
});
