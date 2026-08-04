/**
 * FI-TRICHOSCOPY-1B — unit tests for consultation integration pure logic.
 * Covers mandatory cert suite areas that are expressible without live staging.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDecisionLinkAllowed,
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
  assertConsentForTrichoscopyRequest,
  assertConsultationMutationAllowed,
  buildFindingUniquenessKey,
  isEvidencePackHistoricallyVisible,
  resolvePackSupersessionDisposition,
  resolvePinnedPackVersion,
} from "./packPinning";
import {
  buildPatientSafeTrichoscopySummary,
  formatPatientSafeTrichoscopySummaryText,
} from "./patientSafeSummary";
import {
  resolveConsultationTrichoscopyReadiness,
  resolveConsultationTrichoscopyStatus,
  HLI_OUTAGE_USER_MESSAGE,
} from "./status";
import {
  capabilitiesForTier,
  evaluateTrichoscopyAccessLayers,
  hasCapability,
} from "@/src/lib/platform/entitlements/trichoscopyCapabilities";
import {
  buildOutboundHliHeaders,
  HDR_SIGNATURE,
  verifyHliTrichoscopySignature,
  verifyHliTrichoscopyTimestamp,
} from "@/src/lib/integrations/hliTrichoscopy/eventVerifier";
import { processHliTrichoscopyEvent } from "@/src/lib/integrations/hliTrichoscopy/events";

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

describe("consultation readiness / outage fallback", () => {
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

describe("indication and consent rules", () => {
  it("requires capture and transfer consent before request", () => {
    assert.equal(
      assertConsentForTrichoscopyRequest({
        patientConsentCapture: false,
        patientConsentTransfer: true,
      }).ok,
      false
    );
    assert.equal(
      assertConsentForTrichoscopyRequest({
        patientConsentCapture: true,
        patientConsentTransfer: false,
      }).ok,
      false
    );
    assert.equal(
      assertConsentForTrichoscopyRequest({
        patientConsentCapture: true,
        patientConsentTransfer: true,
      }).ok,
      true
    );
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

  it("allows investigation without acceptance acknowledgement", () => {
    const ok = assertDiagnosisAcceptanceGuard({
      decisionKind: "investigation",
      acknowledgementState: "acknowledged",
    });
    assert.equal(ok.ok, true);
  });

  it("freezes completed consultation reviews", () => {
    const gate = assertFindingReviewAllowed({
      consultationFinalised: true,
      acknowledgementState: "accepted_into_assessment",
    });
    assert.equal(gate.ok, false);
  });

  it("blocks decision links on completed consultations", () => {
    const gate = assertDecisionLinkAllowed({
      consultationFinalised: true,
      decisionKind: "investigation",
      acknowledgementState: "accepted_into_assessment",
    });
    assert.equal(gate.ok, false);
  });
});

describe("pack pinning and completed-consultation immutability", () => {
  it("pins on first acceptance and refuses silent re-pin", () => {
    const first = resolvePinnedPackVersion({
      existingPinnedVersion: null,
      candidatePackVersion: "v1",
    });
    assert.equal(first.newlyPinned, true);
    assert.equal(first.packVersion, "v1");

    const second = resolvePinnedPackVersion({
      existingPinnedVersion: "v1",
      candidatePackVersion: "v2",
    });
    assert.equal(second.newlyPinned, false);
    assert.equal(second.packVersion, "v1");
  });

  it("finalised consultations audit-only on superseding packs", () => {
    assert.equal(
      resolvePackSupersessionDisposition({
        consultationFinalised: true,
        pinnedPackVersion: "v1",
        incomingPackVersion: "v2",
      }),
      "audit_only_leave_pin"
    );
    assert.equal(
      resolvePackSupersessionDisposition({
        consultationFinalised: false,
        pinnedPackVersion: "v1",
        incomingPackVersion: "v2",
      }),
      "sync_findings"
    );
  });

  it("blocks clinical mutations after finalise except follow-up", () => {
    assert.equal(
      assertConsultationMutationAllowed({
        consultationFinalised: true,
        mutationKind: "review",
      }).ok,
      false
    );
    assert.equal(
      assertConsultationMutationAllowed({
        consultationFinalised: true,
        mutationKind: "sync_findings",
      }).ok,
      false
    );
    assert.equal(
      assertConsultationMutationAllowed({
        consultationFinalised: true,
        mutationKind: "follow_up",
      }).ok,
      true
    );
  });

  it("keeps superseded and withdrawn packs historically visible", () => {
    assert.equal(isEvidencePackHistoricallyVisible("active"), true);
    assert.equal(isEvidencePackHistoricallyVisible("superseded"), true);
    assert.equal(isEvidencePackHistoricallyVisible("withdrawn"), true);
    assert.equal(isEvidencePackHistoricallyVisible("deleted"), false);
  });
});

describe("data constraints and uniqueness", () => {
  it("builds stable finding uniqueness keys for duplicate import safety", () => {
    const a = buildFindingUniquenessKey({
      tenantId: "t1",
      evidencePackId: "pack-1",
      findingCode: "miniaturisation_indicators",
      observedRegion: "vertex",
    });
    const b = buildFindingUniquenessKey({
      tenantId: "t1",
      evidencePackId: "pack-1",
      findingCode: "miniaturisation_indicators",
      observedRegion: "vertex",
    });
    assert.equal(a, b);
    const otherRegion = buildFindingUniquenessKey({
      tenantId: "t1",
      evidencePackId: "pack-1",
      findingCode: "miniaturisation_indicators",
      observedRegion: "frontal",
    });
    assert.notEqual(a, otherRegion);
  });

  it("treats missing region as '-' for uniqueness", () => {
    const a = buildFindingUniquenessKey({
      tenantId: "t1",
      evidencePackId: "p",
      findingCode: "x",
      observedRegion: null,
    });
    assert.ok(a.endsWith(":-") || a.endsWith(": -") === false);
    assert.equal(a, "t1:p:x:-");
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

  it("replay of same pack payload yields identical finding codes", () => {
    const payload = {
      findings: [{ findingCode: "diffuse_thinning", findingDomain: "distribution_pattern" }],
    };
    const first = normaliseTrichoscopyFindingsFromPack(payload).map((f) => f.findingCode);
    const second = normaliseTrichoscopyFindingsFromPack(payload).map((f) => f.findingCode);
    assert.deepEqual(first, second);
  });
});

describe("idempotency / duplicate request safety", () => {
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

describe("patient-safe visibility boundaries", () => {
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

describe("1B capability packaging and role / tenant guards", () => {
  it("clinical tier includes accept_findings; surgical does not", () => {
    assert.equal(hasCapability(capabilitiesForTier("clinical"), "trichoscopy.accept_findings"), true);
    assert.equal(hasCapability(capabilitiesForTier("surgical"), "trichoscopy.accept_findings"), false);
    assert.equal(hasCapability(capabilitiesForTier("clinical"), "trichoscopy.review_findings"), true);
  });

  it("surgical-only user cannot accept findings via access layers", () => {
    const result = evaluateTrichoscopyAccessLayers({
      platformEnabled: true,
      entitlementStatus: "active",
      capabilityTier: "surgical",
      subscribedCapabilities: [...capabilitiesForTier("surgical")],
      tenantModuleEnabled: true,
      tenantConfigCapabilities: [...capabilitiesForTier("surgical")],
      platformCapabilities: [...capabilitiesForTier("complete")],
      userPermitted: true,
      resourceAccessible: true,
      requestedCapability: "trichoscopy.accept_findings",
    });
    assert.equal(result.allowed, false);
    assert.equal(result.denialReason, "capability_not_included");
  });

  it("reception / unpermitted user cannot access clinical findings review", () => {
    const result = evaluateTrichoscopyAccessLayers({
      platformEnabled: true,
      entitlementStatus: "active",
      capabilityTier: "clinical",
      subscribedCapabilities: [...capabilitiesForTier("clinical")],
      tenantModuleEnabled: true,
      tenantConfigCapabilities: [...capabilitiesForTier("clinical")],
      platformCapabilities: [...capabilitiesForTier("complete")],
      userPermitted: false,
      resourceAccessible: true,
      requestedCapability: "trichoscopy.review_findings",
    });
    assert.equal(result.allowed, false);
    assert.equal(result.denialReason, "user_not_permitted");
  });

  it("cross-tenant consultation resource access is denied", () => {
    const result = evaluateTrichoscopyAccessLayers({
      platformEnabled: true,
      entitlementStatus: "active",
      capabilityTier: "clinical",
      subscribedCapabilities: [...capabilitiesForTier("clinical")],
      tenantModuleEnabled: true,
      tenantConfigCapabilities: [...capabilitiesForTier("clinical")],
      platformCapabilities: [...capabilitiesForTier("complete")],
      userPermitted: true,
      resourceAccessible: false,
      requestedCapability: "trichoscopy.view_evidence",
    });
    assert.equal(result.allowed, false);
    assert.equal(result.denialReason, "resource_not_accessible");
  });

  it("capture tier (patient-facing adjacent) cannot review clinical findings", () => {
    const result = evaluateTrichoscopyAccessLayers({
      platformEnabled: true,
      entitlementStatus: "active",
      capabilityTier: "capture",
      subscribedCapabilities: [...capabilitiesForTier("capture")],
      tenantModuleEnabled: true,
      tenantConfigCapabilities: [...capabilitiesForTier("capture")],
      platformCapabilities: [...capabilitiesForTier("complete")],
      userPermitted: true,
      resourceAccessible: true,
      requestedCapability: "trichoscopy.review_findings",
    });
    assert.equal(result.allowed, false);
    assert.equal(result.denialReason, "capability_not_included");
  });
});

describe("HLI signature gates before clinical writes (1B cert negatives)", () => {
  function headersFromRecord(rec: Record<string, string>): Headers {
    const h = new Headers();
    for (const [k, v] of Object.entries(rec)) h.set(k, v);
    return h;
  }

  it("rejects invalid HLI signature before clinical writes", async () => {
    const secret = "test-hli-trichoscopy-webhook-secret-32!";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const body = JSON.stringify({
      eventId: "evt-1b-inv",
      eventType: "trichoscopy.session_created",
      eventVersion: "1",
      occurredAt: new Date().toISOString(),
      tenantReference: tenantId,
      patientReference: "hli-pt-1",
      idempotencyKey: "idem-1b-inv",
    });
    const signed = buildOutboundHliHeaders({ tenantId, secret, body });
    signed[HDR_SIGNATURE] = "00".repeat(32);

    const result = await processHliTrichoscopyEvent({
      headers: headersFromRecord(signed),
      rawBody: body,
      env: {
        FI_ENABLE_HLI_TRICHOSCOPY: "1",
        HLI_TRICHOSCOPY_WEBHOOK_SECRET: secret,
        HLI_TRICHOSCOPY_SIGNING_SECRET: secret,
        HLI_TRICHOSCOPY_API_BASE_URL: "https://hli.example",
        HLI_TRICHOSCOPY_SERVICE_KEY: "svc",
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "signature_invalid");
  });

  it("rejects expired / skewed timestamps", () => {
    const stale = String(Date.now() - 15 * 60 * 1000);
    assert.equal(verifyHliTrichoscopyTimestamp(stale), false);
    assert.equal(verifyHliTrichoscopyTimestamp(String(Date.now())), true);
  });

  it("builds signatures that verify (replay foundation)", () => {
    const secret = "test-hli-trichoscopy-webhook-secret-32!";
    const tenantId = "tenant-1b";
    const body = '{"ok":true}';
    const headers = buildOutboundHliHeaders({ tenantId, secret, body });
    assert.equal(
      verifyHliTrichoscopySignature({
        secret,
        timestamp: headers["x-fi-timestamp"],
        requestId: headers["x-fi-request-id"],
        tenantId,
        body,
        signature: headers[HDR_SIGNATURE],
      }),
      true
    );
  });
});
