import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildDeterministicSummaryPayload,
  finalizeDeterministicResult,
} from "../src/lib/patients/ai-summary/patientAiSummaryDeterministic";
import { parsePatientAiSummaryLlmJson } from "../src/lib/patients/ai-summary/patientAiSummaryParse";
import {
  checkPatientAiSummarySafety,
  textContainsBlockedPhrase,
} from "../src/lib/patients/ai-summary/patientAiSummarySafety";
import type { PatientAiSummaryFacts } from "../src/lib/patients/ai-summary/patientAiSummaryTypes";
import {
  PATIENT_AI_SUMMARY_DISCLAIMER,
  PATIENT_AI_SUMMARY_TENANT_FLAG,
} from "../src/lib/patients/ai-summary/patientAiSummaryTypes";
import { getGuidedAssistQuickActionByCode } from "../src/lib/onboarding-os/guidedAssistCatalog";

function sampleFacts(partial: Partial<PatientAiSummaryFacts> = {}): PatientAiSummaryFacts {
  return {
    patientId: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    displayName: "Alex",
    patientStatus: "active",
    recordCreatedOn: "2026-01-10",
    imageCount: 0,
    hasBaselinePhotos: false,
    missingPhotoCategories: ["front"],
    upcomingAppointmentCount: 0,
    nextAppointmentOn: null,
    pastAppointmentCount: 2,
    openLeadCount: 1,
    openCaseCount: 0,
    caseStatuses: [],
    recentActivityKinds: ["booking_completed"],
    timelineItems: [
      { occurredOn: "2026-06-01", kind: "booking_completed", label: "Visit completed" },
    ],
    scalesRecordedFlags: [],
    hasAdminNote: true,
    reminderConsent: true,
    ...partial,
  };
}

describe("AI Patient Summary — safety & deterministic", () => {
  it("blocks clinical advice phrases", () => {
    assert.ok(textContainsBlockedPhrase("You should prescribe minoxidil"));
    assert.equal(textContainsBlockedPhrase("Open imaging folder when ready"), null);
  });

  it("safety check rejects treatment language and falls back path", () => {
    const safety = checkPatientAiSummarySafety({
      overview: "I recommend treating with a full treatment plan.",
      timelineHighlights: [],
      operationalFlags: [],
      suggestedNextSteps: ["Start finasteride"],
    });
    assert.equal(safety.blocked, true);
    assert.equal(safety.ok, false);
  });

  it("deterministic summary is operational and includes disclaimer", () => {
    const facts = sampleFacts();
    const payload = buildDeterministicSummaryPayload(facts);
    assert.ok(payload.overview.includes("Alex"));
    assert.ok(payload.operationalFlags.some((f) => f.code === "missing_photos"));
    assert.ok(payload.suggestedNextSteps.length >= 1);
    assert.ok(!textContainsBlockedPhrase(payload.overview));

    const result = finalizeDeterministicResult({
      facts,
      source: "deterministic",
    });
    assert.equal(result.disclaimer, PATIENT_AI_SUMMARY_DISCLAIMER);
    assert.ok(result.quickLinks.some((q) => q.code === "imaging"));
    assert.ok(result.intro.toLowerCase().includes("clear picture"));
  });

  it("parses model JSON and strips fences", () => {
    const raw = `\`\`\`json
{"overview":"Record looks complete operationally.","timelineHighlights":[{"occurredOn":"2026-01-01","kind":"record","label":"Created"}],"operationalFlags":[{"code":"ok","label":"No gaps","severity":"info"}],"suggestedNextSteps":["Review timeline"]}
\`\`\``;
    const parsed = parsePatientAiSummaryLlmJson(raw);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.match(parsed.payload.overview, /operationally/i);
      assert.equal(parsed.payload.timelineHighlights.length, 1);
    }
  });

  it("catalog exposes Open AI Summary quick action", () => {
    const qa = getGuidedAssistQuickActionByCode("qa_ai_patient_summary");
    assert.ok(qa);
    assert.equal(qa!.requiresPatientContext, true);
    assert.ok(qa!.roles?.includes("doctor"));
    assert.ok(!/diagnos|prescri/i.test(qa!.description));
  });

  it("tenant flag key is stable", () => {
    assert.equal(PATIENT_AI_SUMMARY_TENANT_FLAG, "ai_patient_summary_enabled");
  });
});
