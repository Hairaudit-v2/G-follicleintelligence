import test from "node:test";
import assert from "node:assert/strict";
import {
  consultationChecklistConsentComplexityDistribution,
  consultationChecklistDelayRecommendationRate,
  consultationChecklistExpectationManagementRate,
  consultationChecklistMedicationDiscussionRate,
  consultationChecklistPriorityDistribution,
  consultationChecklistRiskFlagFrequency,
  type ConsultationChecklistAnalyticsRow,
} from "./checklistAnalytics";

const rows: ConsultationChecklistAnalyticsRow[] = [
  {
    priority_level: "high",
    delay_recommended: true,
    expectation_management_required: true,
    medication_discussion_required: false,
    consent_complexity_level: "high",
    risk_flags: ["A", "B"],
  },
  {
    priority_level: "low",
    delay_recommended: false,
    expectation_management_required: false,
    medication_discussion_required: true,
    consent_complexity_level: null,
    risk_flags: ["A"],
  },
];

test("analytics rates and distributions", () => {
  assert.deepEqual(consultationChecklistPriorityDistribution(rows), {
    low: 1,
    moderate: 0,
    high: 1,
    urgent: 0,
  });
  assert.equal(consultationChecklistDelayRecommendationRate(rows), 0.5);
  assert.equal(consultationChecklistExpectationManagementRate(rows), 0.5);
  assert.equal(consultationChecklistMedicationDiscussionRate(rows), 0.5);
  const consent = consultationChecklistConsentComplexityDistribution(rows);
  assert.equal(consent.high, 1);
  assert.equal(consent.unset, 1);
  const flags = consultationChecklistRiskFlagFrequency(rows);
  assert.equal(flags.A, 2);
  assert.equal(flags.B, 1);
});
