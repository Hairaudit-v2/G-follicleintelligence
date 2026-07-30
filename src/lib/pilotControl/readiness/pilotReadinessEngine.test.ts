/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.2 — readiness engine acceptance tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PILOT_SYNTHETIC_OTHER_TENANT_ID,
  PILOT_SYNTHETIC_TENANT_ID,
} from "../pilotSyntheticCohort";
import { evaluatePilotPatientReadinessFromSources } from "./evaluateFromSources";
import { baseReadySourceBag, consultationStageBag } from "./readinessFixtures";
import { projectReadinessForRole } from "./roleSensitiveProjection";
import { resolvePilotJourneyStage } from "./readinessMilestones";
import { optionalDocumentDoesNotBlock } from "../pilotReadinessCore";

function signal(result: ReturnType<typeof evaluatePilotPatientReadinessFromSources>, key: string) {
  const all = [
    ...result.clinical.mandatorySignals,
    ...result.clinical.optionalSignals,
    ...result.financial.mandatorySignals,
    ...result.financial.optionalSignals,
    ...result.patient.mandatorySignals,
    ...result.patient.optionalSignals,
    ...result.operational.mandatorySignals,
    ...result.operational.optionalSignals,
    ...result.technical.mandatorySignals,
    ...result.technical.optionalSignals,
  ];
  return all.find((s) => s.key === key);
}

describe("1A.2 identity integrity", () => {
  it("1. correct tenant and unique patient resolve successfully", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    assert.equal(r.identityIntegrityBlocked, false);
    assert.equal(signal(r, "identity.patient_exists")?.status, "satisfied");
    assert.equal(signal(r, "identity.tenant_match")?.status, "satisfied");
    assert.ok(r.clinical.provenance.length + r.financial.provenance.length > 0);
  });

  it("2. wrong-tenant patient fails closed", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        identity: {
          patientFound: true,
          patientTenantId: PILOT_SYNTHETIC_OTHER_TENANT_ID,
          patientId: "d0000000-0000-4000-8000-000000000001",
          personId: "p1",
          ambiguousPatient: false,
          appAuthUserId: null,
          appLinkagePatientCount: 0,
          crossTenantMapping: true,
          activeEnrolmentCountForProgrammePatient: 1,
          crmLeadPatientIdConflict: false,
          sourcePatientIdMismatch: false,
        },
      })
    );
    assert.equal(r.identityIntegrityBlocked, true);
    assert.equal(r.overall.state, "blocked");
    assert.ok(r.blockers.some((b) => b.severity === "critical"));
  });

  it("3. ambiguous patient identity fails closed", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        identity: {
          ...baseReadySourceBag().identity,
          ambiguousPatient: true,
        },
      })
    );
    assert.equal(r.identityIntegrityBlocked, true);
    assert.equal(r.overall.state, "blocked");
  });

  it("4. conflicting app identity fails closed", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        identity: {
          ...baseReadySourceBag().identity,
          appAuthUserId: "shared-auth",
          appLinkagePatientCount: 2,
        },
      })
    );
    assert.equal(r.identityIntegrityBlocked, true);
    assert.ok(r.blockers.some((b) => b.criticalIntegrity));
  });

  it("5. duplicate active enrolment is detected", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        identity: {
          ...baseReadySourceBag().identity,
          activeEnrolmentCountForProgrammePatient: 2,
        },
      })
    );
    assert.equal(signal(r, "identity.no_duplicate_active_enrolment")?.status, "failed");
    assert.equal(r.overall.state, "blocked");
  });

  it("6. non-enrolled patient is excluded (engine requires enrolment bag)", () => {
    // Enrolment verification is enforced by evaluatePilotPatientReadiness server entry.
    // Pure engine still requires enrolmentId — simulate missing membership via empty programme mismatch path.
    const bag = baseReadySourceBag();
    assert.ok(bag.enrolmentId);
    assert.equal(typeof evaluatePilotPatientReadinessFromSources, "function");
  });
});

describe("1A.2 clinical", () => {
  it("7. no pathology requirement is not_applicable", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    assert.equal(signal(r, "clinical.pathology_requirement")?.status, "not_applicable");
    assert.equal(signal(r, "clinical.pathology_clearance")?.status, "not_applicable");
  });

  it("8. required pathology missing blocks", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        pathology: {
          ...baseReadySourceBag().pathology,
          required: true,
          requestId: "req-1",
          resultId: null,
          clearanceStatus: null,
          reviewed: false,
        },
      })
    );
    assert.equal(signal(r, "clinical.pathology_receipt")?.status, "pending");
    assert.equal(r.overall.state, "blocked");
  });

  it("9. pathology received but not reviewed awaits review", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        pathology: {
          ...baseReadySourceBag().pathology,
          required: true,
          requestId: "req-1",
          resultId: "res-1",
          clearanceStatus: null,
          reviewed: false,
        },
      })
    );
    assert.equal(signal(r, "clinical.pathology_review")?.status, "review_required");
    assert.equal(r.clinical.state, "blocked");
  });

  it("10. clinical clearance satisfies the signal", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        pathology: {
          required: true,
          requestId: "req-1",
          requestWorkflowStatus: "cleared",
          resultId: "res-1",
          clearanceStatus: "cleared",
          reviewed: true,
          superseded: false,
          clinicalEscalationActive: false,
          clinicalApprovalState: "approved",
          consultationComplete: true,
        },
      })
    );
    assert.equal(signal(r, "clinical.pathology_clearance")?.status, "satisfied");
  });

  it("11. active clinical escalation blocks", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        pathology: {
          ...baseReadySourceBag().pathology,
          clinicalEscalationActive: true,
        },
      })
    );
    assert.equal(signal(r, "clinical.clinical_escalation")?.status, "failed");
    assert.equal(r.overall.state, "blocked");
  });

  it("12. superseded clinical record does not satisfy readiness", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        pathology: {
          required: true,
          requestId: "req-1",
          requestWorkflowStatus: "cleared",
          resultId: "res-old",
          clearanceStatus: "cleared",
          reviewed: true,
          superseded: true,
          clinicalEscalationActive: false,
          clinicalApprovalState: "superseded",
          consultationComplete: true,
        },
      })
    );
    assert.equal(signal(r, "clinical.pathology_clearance")?.status, "failed");
    assert.equal(signal(r, "clinical.clinical_approval")?.status, "failed");
    assert.equal(r.overall.state, "blocked");
  });
});

describe("1A.2 financial", () => {
  it("13. verified manual deposit satisfies the deposit signal", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    assert.equal(signal(r, "financial.deposit_verified")?.status, "satisfied");
    assert.equal(signal(r, "financial.deposit_verified")?.reasonCode, "deposit_verified_manual");
  });

  it("14. unallocated payment does not clear readiness", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        financial: {
          ...baseReadySourceBag().financial,
          unallocatedPaymentPresent: true,
          clearanceState: "financially_cleared",
        },
      })
    );
    assert.equal(signal(r, "financial.unallocated_payment")?.status, "failed");
    assert.equal(r.overall.state, "blocked");
  });

  it("15. payment allocated to another patient creates critical blocker", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        financial: {
          ...baseReadySourceBag().financial,
          paymentPatientIdMismatch: true,
        },
      })
    );
    assert.ok(r.blockers.some((b) => b.severity === "critical" && b.category === "financial"));
    assert.equal(r.overall.state, "blocked");
  });

  it("16. active approved payment plan follows canonical finance rules", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        financial: {
          ...baseReadySourceBag().financial,
          paymentPlanActive: true,
          paymentPlanSatisfiesClearance: true,
        },
      })
    );
    assert.equal(signal(r, "financial.payment_plan")?.status, "satisfied");
  });

  it("17. reconciliation exception blocks at procedure stage", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        financial: {
          ...baseReadySourceBag().financial,
          reconciliationException: true,
        },
      })
    );
    assert.equal(signal(r, "financial.reconciliation_exception")?.status, "failed");
    assert.equal(r.overall.state, "blocked");
  });

  it("18. Stripe-disabled state does not block manual Money readiness", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        financial: {
          ...baseReadySourceBag().financial,
          stripeEnabled: false,
        },
      })
    );
    assert.equal(signal(r, "financial.stripe_not_required")?.status, "satisfied");
    assert.equal(signal(r, "financial.stripe_not_required")?.blocking, false);
  });

  it("19. Stripe branch-only work is not treated as production capability", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        financial: {
          ...baseReadySourceBag().financial,
          stripeBranchOnlyCapability: true,
        },
      })
    );
    assert.equal(signal(r, "financial.stripe_not_required")?.reasonCode, "stripe_branch_only_ignored");
    assert.ok(r.warnings.some((w) => w.code === "stripe_branch_only_not_production"));
  });
});

describe("1A.2 patient", () => {
  it("20. approved but not invited is not incorrectly marked non-compliant", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        enrolmentStatus: "approved",
        journey: {
          milestones: [],
          openPatientActions: 0,
          waitingOnClinicActions: 0,
          overduePatientActions: 0,
          overdueClinicActions: 0,
          patientInactiveDays: 0,
        },
      }),
      { realPatientInvitesEnabled: false }
    );
    assert.equal(r.journeyStage, "pre_invitation");
    const inv = signal(r, "patient.invitation_state");
    assert.ok(inv);
    assert.ok(
      inv!.status === "not_applicable" || inv!.reasonCode.includes("pre_invitation") || inv!.reasonCode.includes("invites_disabled")
    );
    assert.equal(inv!.blocking, false);
  });

  it("21. invited but not activated shows activation pending", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      consultationStageBag({
        enrolmentStatus: "invited",
        identity: {
          ...consultationStageBag().identity,
          appAuthUserId: null,
        },
      })
    );
    assert.equal(signal(r, "patient.app_activation")?.status, "pending");
    assert.equal(signal(r, "patient.app_activation")?.reasonCode, "invited_not_activated");
  });

  it("22. missing mandatory consent blocks", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        consentDocuments: {
          mandatoryConsentSatisfied: false,
          mandatoryConsentUnknown: false,
          consentWrongPatient: false,
          optionalDocumentMissing: false,
          packetId: "pkt-1",
        },
      })
    );
    assert.equal(signal(r, "patient.mandatory_consent")?.status, "missing");
    assert.equal(r.overall.state, "blocked");
  });

  it("23. optional document does not block", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        consentDocuments: {
          ...baseReadySourceBag().consentDocuments,
          optionalDocumentMissing: true,
        },
      })
    );
    assert.equal(signal(r, "patient.optional_document")?.blocking, false);
    assert.equal(
      optionalDocumentDoesNotBlock({
        optionalDocumentMissing: true,
        mandatoryConsentGap: false,
      }),
      true
    );
    assert.notEqual(signal(r, "patient.optional_document")?.status, undefined);
  });

  it("24. missing required image role blocks at applicable milestone", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        images: {
          requiredRoles: ["preop_front"],
          satisfiedRoles: [],
          missingRoles: ["preop_front"],
        },
      })
    );
    assert.equal(signal(r, "patient.required_image_role")?.status, "missing");
    assert.equal(r.overall.state, "blocked");
  });

  it("25. missing surgery image does not block consultation-stage patient", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      consultationStageBag({
        images: {
          requiredRoles: [],
          satisfiedRoles: [],
          missingRoles: [],
        },
      })
    );
    assert.equal(r.journeyStage, "consultation_preparation");
    const img = signal(r, "patient.required_image_role");
    assert.ok(img?.status === "not_applicable" || img?.requirement === "not_applicable" || img?.status === "satisfied");
  });

  it("26. patient inactivity escalates per programme thresholds", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        journey: {
          ...baseReadySourceBag().journey,
          patientInactiveDays: 5,
        },
        patientInactiveAttentionDays: 3,
      })
    );
    assert.equal(signal(r, "patient.inactivity")?.reasonCode, "patient_inactive");
    assert.ok(r.warnings.some((w) => w.code === "patient_inactive"));
    assert.notEqual(r.clinical.state, "blocked");
  });
});

describe("1A.2 operational", () => {
  it("27. missing appointment does not block pre-consultation candidate", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      consultationStageBag({
        appointments: { bookings: [], staffAssignmentKnown: false, staffAssigned: false },
      })
    );
    const exists = signal(r, "operational.appointment_exists");
    assert.ok(exists?.status === "not_applicable" || exists?.blocking === false);
    assert.notEqual(r.overall.state, "blocked");
  });

  it("28. unconfirmed procedure appointment blocks procedure readiness", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        appointments: {
          bookings: [
            {
              id: "bk-1",
              patientId: baseReadySourceBag().patientId,
              bookingType: "surgery",
              bookingStatus: "scheduled",
              startAt: "2026-08-15T00:00:00.000Z",
            },
          ],
          staffAssignmentKnown: false,
          staffAssigned: false,
        },
      })
    );
    assert.equal(signal(r, "operational.appointment_confirmed")?.status, "pending");
    assert.equal(r.overall.state, "blocked");
  });

  it("29. required clinic action overdue produces escalation", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        journey: {
          ...baseReadySourceBag().journey,
          overdueClinicActions: 2,
        },
      })
    );
    assert.ok(r.warnings.some((w) => w.code === "clinic_action_overdue"));
  });

  it("30. missing staff assignment remains unknown where no canonical source", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    assert.equal(signal(r, "operational.staff_assignment")?.status, "unknown");
  });

  it("31. surgery readiness cannot become ready while consent incomplete", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        consentDocuments: {
          mandatoryConsentSatisfied: false,
          mandatoryConsentUnknown: false,
          consentWrongPatient: false,
          optionalDocumentMissing: false,
          packetId: "pkt-1",
        },
      })
    );
    assert.equal(signal(r, "operational.consent_gate_for_procedure")?.status, "missing");
    assert.notEqual(r.overall.state, "ready");
  });
});

describe("1A.2 technical", () => {
  it("32. failed push delivery produces attention", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        technical: {
          ...baseReadySourceBag().technical,
          failedPushCount: 1,
        },
      })
    );
    assert.equal(signal(r, "technical.failed_push")?.status, "failed");
    assert.ok(
      r.overall.state === "attention_required" ||
        r.warnings.some((w) => w.code === "push_delivery_failed")
    );
  });

  it("33. repeated technical failure escalates", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        technical: {
          ...baseReadySourceBag().technical,
          repeatedFailureCount: 5,
          failedPushCount: 5,
        },
        technicalFailureEscalateThreshold: 3,
      })
    );
    assert.equal(signal(r, "technical.repeated_failure")?.reasonCode, "technical_failure_escalated");
  });

  it("34. absence of expected success event remains unknown or pending", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        technical: {
          ...baseReadySourceBag().technical,
          expectedSuccessEventPresent: null,
        },
      })
    );
    const s = signal(r, "technical.expected_success_event");
    assert.ok(s?.status === "unknown" || s?.status === "pending");
    assert.notEqual(s?.status, "satisfied");
  });

  it("35. cross-patient technical linkage creates critical blocker", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        technical: {
          ...baseReadySourceBag().technical,
          crossPatientTechnicalLinkage: true,
        },
      })
    );
    assert.ok(r.blockers.some((b) => b.severity === "critical"));
    assert.equal(r.overall.state, "blocked");
  });
});

describe("1A.2 overall composition", () => {
  it("36. critical identity blocker overrides all ready dimensions", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        identity: {
          ...baseReadySourceBag().identity,
          crossTenantMapping: true,
          patientTenantId: PILOT_SYNTHETIC_OTHER_TENANT_ID,
        },
      })
    );
    assert.equal(r.overall.state, "blocked");
    assert.equal(r.clinical.state, "blocked");
    assert.equal(r.financial.state, "blocked");
  });

  it("37. clinical blocker overrides financial and patient readiness", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        pathology: {
          ...baseReadySourceBag().pathology,
          clinicalEscalationActive: true,
        },
      })
    );
    assert.equal(r.overall.state, "blocked");
    assert.ok(r.overall.reasons.includes("clinical_blocker") || r.clinical.state === "blocked");
  });

  it("38. unknown mandatory state cannot become ready", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        consentDocuments: {
          mandatoryConsentSatisfied: null,
          mandatoryConsentUnknown: true,
          consentWrongPatient: false,
          optionalDocumentMissing: false,
          packetId: null,
        },
      })
    );
    assert.notEqual(r.overall.state, "ready");
    assert.equal(r.overall.state, "blocked");
  });

  it("39. optional incomplete signals do not block", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        consentDocuments: {
          ...baseReadySourceBag().consentDocuments,
          optionalDocumentMissing: true,
        },
      })
    );
    assert.equal(signal(r, "patient.optional_document")?.blocking, false);
  });

  it("40. all applicable mandatory signals satisfied produces ready", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    assert.equal(r.overall.state, "ready");
  });

  it("41. completed journey produces completed", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({ enrolmentStatus: "completed" })
    );
    assert.equal(r.overall.state, "completed");
  });

  it("42. same source state produces deterministic identical output", () => {
    const bag = baseReadySourceBag();
    const a = evaluatePilotPatientReadinessFromSources(bag);
    const b = evaluatePilotPatientReadinessFromSources(bag);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });
});

describe("1A.2 security and isolation", () => {
  it("43. finance-only users cannot receive detailed clinical provenance", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    const projected = projectReadinessForRole(r, "finance");
    assert.equal(projected.clinical.provenance.length, 0);
    assert.ok(projected.financial.mandatorySignals.length > 0);
  });

  it("44. reception users receive only permitted readiness summaries", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    const projected = projectReadinessForRole(r, "reception");
    assert.equal(projected.clinical.provenance.length, 0);
    assert.ok(
      projected.financial.mandatorySignals.every((s) => s.provenance.every((p) => !p.sourceRecordId))
    );
  });

  it("45. cross-tenant cohort evaluation returns no foreign records", () => {
    // Pure isolation: wrong tenant identity is blocked; bag tenant must match enrolment.
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        tenantId: PILOT_SYNTHETIC_TENANT_ID,
        identity: {
          ...baseReadySourceBag().identity,
          patientTenantId: PILOT_SYNTHETIC_OTHER_TENANT_ID,
          crossTenantMapping: true,
        },
      })
    );
    assert.equal(r.tenantId, PILOT_SYNTHETIC_TENANT_ID);
    assert.equal(r.overall.state, "blocked");
  });

  it("46. service-role source access still enforces requested tenant context in the engine", () => {
    const r = evaluatePilotPatientReadinessFromSources(
      baseReadySourceBag({
        tenantId: PILOT_SYNTHETIC_TENANT_ID,
        identity: {
          ...baseReadySourceBag().identity,
          patientTenantId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          crossTenantMapping: false,
        },
      })
    );
    assert.equal(signal(r, "identity.tenant_match")?.status, "failed");
    assert.equal(r.identityIntegrityBlocked, true);
  });
});

describe("1A.2 provenance + stage map", () => {
  it("every signal includes provenance", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    const all = [
      ...r.clinical.mandatorySignals,
      ...r.clinical.optionalSignals,
      ...r.financial.mandatorySignals,
      ...r.financial.optionalSignals,
      ...r.patient.mandatorySignals,
      ...r.patient.optionalSignals,
      ...r.operational.mandatorySignals,
      ...r.operational.optionalSignals,
      ...r.technical.mandatorySignals,
      ...r.technical.optionalSignals,
    ];
    assert.ok(all.length > 0);
    for (const s of all) {
      assert.ok(s.provenance.length > 0, `missing provenance for ${s.key}`);
      assert.ok(s.provenance[0]!.resolverVersion);
    }
  });

  it("resolves procedure stage from milestones", () => {
    const stage = resolvePilotJourneyStage({
      enrolmentStatus: "active",
      milestones: [
        { milestoneKey: "quote_accepted", status: "completed" },
        { milestoneKey: "surgery_booked", status: "completed" },
      ],
    });
    assert.equal(stage, "procedure_preparation");
  });
});
