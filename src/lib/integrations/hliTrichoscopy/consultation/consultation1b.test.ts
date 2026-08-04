/**
 * FI-TRICHOSCOPY-1B — unit tests for consultation integration pure logic.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDiagnosisAcceptanceGuard,
  assertFindingReviewAllowed,
  canTransitionAcknowledgement,
  isAcceptanceAcknowledgement,
} from "./acknowledgement";
import { normaliseTrichoscopyFindingsFromPack, groupFindingsByDomain } from "./findings";
import {
  buildConsultationTrichoscopyIdempotencyKey,
  buildFiOsToHliConsultationContext,
  sanitiseFreeText,
} from "./idempotency";
import {
  buildPatientSafeTrichoscopySummary,
  formatPatientSafeTrichoscopySummaryText,
} from "./patientSafeSummary";
import {
  resolveConsultationTrichoscopyReadiness,
  resolveConsultationTrichoscopyStatus,
  HLI_OUTAGE_USER_MESSAGE,
} from "./status";
import { capabilitiesForTier, hasCapability } from "@/src/lib/platform/entitlements/trichoscopyCapabilities";

describe("consultation trichoscopy status", () => {
  it("marks not required when clinician opts out", () => {
    assert.equal(
      resolveConsultationTrichoscopyStatus({ markedNotRequired: true }),
      "not_required"
    );
  });

  it("requires before treatment when wait flag set without link", () => {
    assert.equal(
      resolveConsultationTrichoscopyStatus({
        hasIndication: true,
        waitForTreatmentPlanning: true,
      }),
      "required_before_treatment"
    );
  });

  it("maps link statuses into consultation statuses", () => {
    assert.equal(
      resolveConsultationTrichoscopyStatus({ linkStatus: "requested" }),
      "requested"
    );
    assert.equal(
      resolveConsultationTrichoscopyStatus({ linkStatus: "capture_in_progress" }),
      "in_progress"
    );
    assert.equal(
      resolveConsultationTrichoscopyStatus({ linkStatus: "confirmed" }),
      "ready_for_review"
    );
    assert.equal(
      resolveConsultationTrichoscopyStatus({
        linkStatus: "confirmed",
        findingsReviewed: true,
      }),
      "reviewed"
    );
  });

  it("keeps outage as failed without treating it as a clinical finding", () => {
    assert.equal(
      resolveConsultationTrichoscopyStatus({ integrationFailed: true }),
      "failed"
    );
    assert.ok(HLI_OUTAGE_USER_MESSAGE.includes("temporarily unavailable"));
  });
});

describe("consultation readiness", () => {
  it("does not block when trichoscopy is not required", () => {
    const r = resolveConsultationTrichoscopyReadiness({
      consultationStatus: "not_required",
    });
    assert.equal(r.state, "no_trichoscopy_requirement");
    assert.equal(r.blocking, false);
  });

  it("allows complete when pending by default", () => {
    const r = resolveConsultationTrichoscopyReadiness({
      consultationStatus: "requested",
      rules: { allowCompleteWhenPending: true },
    });
    assert.equal(r.blocking, false);
    assert.equal(r.state, "request_pending");
  });

  it("blocks when required before treatment and unresolved", () => {
    const r = resolveConsultationTrichoscopyReadiness({
      consultationStatus: "required_before_treatment",
    });
    assert.equal(r.blocking, true);
    assert.ok(r.blockingReasonCodes.includes("trichoscopy_required_before_treatment"));
  });

  it("does not block documentation during HLI outage by default", () => {
    const r = resolveConsultationTrichoscopyReadiness({
      consultationStatus: "failed",
      failureKind: "hli_unavailable",
      rules: { allowCompleteWhenHliUnavailable: true },
    });
    assert.equal(r.blocking, false);
  });
});

describe("acknowledgement and diagnosis guard", () => {
  it("allows transitions from not_reviewed", () => {
    assert.equal(canTransitionAcknowledgement("not_reviewed", "acknowledged"), true);
    assert.equal(canTransitionAcknowledgement("superseded", "acknowledged"), false);
  });

  it("blocks diagnosis without acceptance", () => {
    const denied = assertDiagnosisAcceptanceGuard({
      decisionKind: "primary_diagnosis",
      acknowledgementState: "acknowledged",
    });
    assert.equal(denied.ok, false);

    const ok = assertDiagnosisAcceptanceGuard({
      decisionKind: "primary_diagnosis",
      acknowledgementState: "accepted_into_assessment",
    });
    assert.equal(ok.ok, true);
    assert.equal(isAcceptanceAcknowledgement("accepted_with_qualification"), true);
  });

  it("freezes completed consultation reviews", () => {
    const gate = assertFindingReviewAllowed({
      consultationFinalised: true,
      acknowledgementState: "accepted_into_assessment",
    });
    assert.equal(gate.ok, false);
  });
});

describe("finding normalisation", () => {
  it("normalises pack findings without inventing diagnoses", () => {
    const findings = normaliseTrichoscopyFindingsFromPack({
      findings: [
        {
          findingCode: "miniaturisation_indicators",
          findingDomain: "hair_follicular",
          observedRegion: "vertex",
          confidence: 0.9,
        },
      ],
      escalations: ["possible_scarring_process"],
      limitations: ["partial_region_coverage"],
    });
    assert.ok(findings.some((f) => f.findingCode === "miniaturisation_indicators"));
    assert.ok(findings.some((f) => f.isEscalation && f.findingCode === "possible_scarring_process"));
    const grouped = groupFindingsByDomain(findings);
    assert.ok(grouped.hair_follicular.length >= 1);
    assert.ok(grouped.safety_escalation.length >= 1);
  });
});

describe("idempotency and payload sanitisation", () => {
  it("builds stable consultation idempotency keys", () => {
    const a = buildConsultationTrichoscopyIdempotencyKey({
      tenantId: "t1",
      patientId: "p1",
      consultationId: "c1",
      requestIntent: "new_assessment",
      clientRequestId: "client-1",
    });
    const b = buildConsultationTrichoscopyIdempotencyKey({
      tenantId: "t1",
      patientId: "p1",
      consultationId: "c1",
      requestIntent: "new_assessment",
      clientRequestId: "client-1",
    });
    assert.equal(a, b);
    assert.equal(a, "t1:p1:c1:new_assessment:client-1");
  });

  it("sanitises free text and builds outbound context", () => {
    assert.equal(sanitiseFreeText("  hello\nworld  "), "hello world");
    const payload = buildFiOsToHliConsultationContext({
      tenantId: "t1",
      patientId: "p1",
      consultationId: "c1",
      requestingClinicianUserId: "u1",
      indication: {
        indicationCodes: ["diffuse_shedding"],
        clinicianQuestion: "Is TE likely?",
        patientConsentCapture: true,
        patientConsentTransfer: true,
        urgency: "routine",
      },
      clientRequestId: "r1",
      requestMode: "new_assessment",
    });
    assert.deepEqual(payload.indicationCodes, ["diffuse_shedding"]);
    assert.equal(payload.consentState.capture, true);
    assert.equal(payload.assessmentPurpose, "consultation");
  });
});

describe("patient-safe summary", () => {
  it("omits clinician-only fields", () => {
    const summary = buildPatientSafeTrichoscopySummary({
      performed: true,
      whyPerformed: "Diffuse shedding assessment",
      regionsReviewed: ["vertex", "frontal"],
      highLevelObservations: ["Variation in shaft diameter noted"],
      forbidden: {
        confidenceValues: [0.91],
        internalRiskScores: { x: 1 },
        differentialRanking: ["a", "b"],
        clinicianOnlyEscalationNotes: "scar concern",
      },
    });
    const text = formatPatientSafeTrichoscopySummaryText(summary);
    assert.ok(text.includes("Trichoscopy was used"));
    assert.ok(text.includes("vertex"));
    assert.ok(!text.includes("0.91"));
    assert.ok(!text.includes("scar concern"));
    assert.ok(summary.omittedClinicianOnlyFields.includes("confidenceValues"));
    assert.ok(summary.omittedClinicianOnlyFields.includes("clinicianOnlyEscalationNotes"));
  });
});

describe("1B capability packaging", () => {
  it("clinical tier includes accept_findings; surgical does not", () => {
    assert.equal(hasCapability(capabilitiesForTier("clinical"), "trichoscopy.accept_findings"), true);
    assert.equal(hasCapability(capabilitiesForTier("surgical"), "trichoscopy.accept_findings"), false);
    assert.equal(hasCapability(capabilitiesForTier("clinical"), "trichoscopy.review_findings"), true);
  });
});
