import test from "node:test";
import assert from "node:assert/strict";
import {
  clampConsultationChecklistConfidence,
  normalizeHieConsultationChecklistStatus,
  normalizeHieConsultationConsentComplexity,
  normalizeHieConsultationPriorityLevel,
  normalizeHieConsultationReviewStatus,
  normalizeHieConsultationSourceSystem,
} from "./enumValidation";

test("normalizeHieConsultationSourceSystem maps known and defaults", () => {
  assert.equal(normalizeHieConsultationSourceSystem("hairaudit"), "hairaudit");
  assert.equal(normalizeHieConsultationSourceSystem("invalid"), "fi_os");
});

test("normalizeHieConsultationPriorityLevel buckets unknown as low", () => {
  assert.equal(normalizeHieConsultationPriorityLevel("high"), "high");
  assert.equal(normalizeHieConsultationPriorityLevel("nope"), "low");
});

test("normalizeHieConsultationConsentComplexity allows null and unknown", () => {
  assert.equal(normalizeHieConsultationConsentComplexity(null), null);
  assert.equal(normalizeHieConsultationConsentComplexity("high"), "high");
  assert.equal(normalizeHieConsultationConsentComplexity("weird"), "unknown");
});

test("clampConsultationChecklistConfidence", () => {
  assert.equal(clampConsultationChecklistConfidence(-1), 0);
  assert.equal(clampConsultationChecklistConfidence(2), 1);
  assert.equal(clampConsultationChecklistConfidence(0.5), 0.5);
});

test("normalize checklist and review statuses", () => {
  assert.equal(normalizeHieConsultationChecklistStatus("approved"), "approved");
  assert.equal(normalizeHieConsultationChecklistStatus("x"), "generated");
  assert.equal(normalizeHieConsultationReviewStatus("corrected"), "corrected");
  assert.equal(normalizeHieConsultationReviewStatus("x"), "pending");
});
