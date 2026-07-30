/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.1 — contract / readiness / cohort tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PILOT_BLOCKER_CATEGORIES,
  PILOT_CONTROL_EVENT_KINDS,
  PILOT_ENROLMENT_STATUSES,
  PILOT_HEALTH_VERDICTS,
  OVERALL_READINESS_STATES,
  pilotControlRoleHasScope,
} from "./pilotControlContracts";
import {
  canTransitionPilotEnrolment,
  computeActivationRate,
  countEnrolmentsByStatus,
  filterEnrolmentsForTenant,
  includeInActiveOperationalMetrics,
  planPilotEnrolmentMutation,
  resolvePilotMembership,
} from "./pilotEnrolmentCore";
import {
  deriveOverallReadiness,
  optionalDocumentDoesNotBlock,
} from "./pilotReadinessCore";
import {
  deriveEscalationLevel,
  mergeEscalationThresholds,
} from "./pilotBlockerCore";
import { derivePilotHealthVerdict } from "./pilotHealthCore";
import {
  PILOT_SYNTHETIC_COHORT,
  PILOT_SYNTHETIC_OTHER_TENANT_ID,
  PILOT_SYNTHETIC_PROGRAMME_ID,
  PILOT_SYNTHETIC_TENANT_ID,
  baseReadySnapshot,
  syntheticCriticalIntegrityBlocker,
} from "./pilotSyntheticCohort";
import { PILOT_READINESS_SOURCE_BINDINGS } from "./pilotSourceBindings";

describe("pilotControlContracts", () => {
  it("locks enrolment statuses and readiness / blocker taxonomies", () => {
    assert.equal(PILOT_ENROLMENT_STATUSES.length, 9);
    assert.equal(OVERALL_READINESS_STATES.length, 6);
    assert.equal(PILOT_BLOCKER_CATEGORIES.length, 19);
    assert.equal(PILOT_CONTROL_EVENT_KINDS.length, 58);
    assert.deepEqual([...PILOT_HEALTH_VERDICTS], ["GREEN", "AMBER", "RED"]);
  });

  it("fail-closes permission scopes for unknown roles", () => {
    assert.equal(pilotControlRoleHasScope(null, "overview_full"), false);
    assert.equal(pilotControlRoleHasScope("reception", "detail_clinical_full"), false);
    assert.equal(pilotControlRoleHasScope("finance", "detail_financial_full"), true);
    assert.equal(pilotControlRoleHasScope("clinical", "detail_financial_full"), false);
  });
});

describe("pilotEnrolmentCore", () => {
  it("never treats activity alone as membership — requires enrolment row", () => {
    const found = resolvePilotMembership({
      tenantId: PILOT_SYNTHETIC_TENANT_ID,
      patientId: "d0000000-0000-4000-8000-000000000099",
      programmeId: PILOT_SYNTHETIC_PROGRAMME_ID,
      enrolments: PILOT_SYNTHETIC_COHORT.map((e) => ({
        tenantId: e.tenantId,
        patientId: e.patientId,
        programmeId: e.programmeId,
        enrolmentStatus: e.enrolmentStatus,
      })),
    });
    assert.equal(found, null);
  });

  it("fails closed on ambiguous duplicate enrolment", () => {
    const base = PILOT_SYNTHETIC_COHORT[0]!;
    const dup = {
      tenantId: base.tenantId,
      patientId: base.patientId,
      programmeId: base.programmeId,
      enrolmentStatus: base.enrolmentStatus,
    };
    const found = resolvePilotMembership({
      tenantId: base.tenantId,
      patientId: base.patientId,
      programmeId: base.programmeId,
      enrolments: [dup, { ...dup }],
    });
    assert.equal(found, null);
  });

  it("filters wrong-tenant enrolments out", () => {
    const rows = filterEnrolmentsForTenant(
      PILOT_SYNTHETIC_COHORT.map((e) => ({
        tenantId: e.tenantId,
        patientId: e.patientId,
        programmeId: e.programmeId,
        enrolmentStatus: e.enrolmentStatus,
      })),
      PILOT_SYNTHETIC_TENANT_ID
    );
    assert.ok(rows.every((r) => r.tenantId === PILOT_SYNTHETIC_TENANT_ID));
    assert.equal(
      rows.some((r) => r.tenantId === PILOT_SYNTHETIC_OTHER_TENANT_ID),
      false
    );
  });

  it("excludes withdrawn from active operational metrics; keeps completed historical", () => {
    assert.equal(includeInActiveOperationalMetrics("withdrawn"), false);
    assert.equal(includeInActiveOperationalMetrics("excluded"), false);
    assert.equal(includeInActiveOperationalMetrics("completed"), false);
    assert.equal(includeInActiveOperationalMetrics("active"), true);
    assert.equal(includeInActiveOperationalMetrics("invited"), true);
  });

  it("requires exclusion reason and validates transitions", () => {
    assert.equal(canTransitionPilotEnrolment("candidate", "approved"), true);
    assert.equal(canTransitionPilotEnrolment("completed", "active"), false);
    const bad = planPilotEnrolmentMutation("candidate", { type: "exclude", reason: "  " });
    assert.equal(bad.ok, false);
    const ok = planPilotEnrolmentMutation("candidate", {
      type: "exclude",
      reason: "Out of scope",
    });
    assert.equal(ok.ok, true);
  });

  it("counts synthetic cohort statuses and activation rate", () => {
    const counts = countEnrolmentsByStatus(
      PILOT_SYNTHETIC_COHORT.filter((e) => e.tenantId === PILOT_SYNTHETIC_TENANT_ID).map(
        (e) => ({ enrolmentStatus: e.enrolmentStatus })
      )
    );
    assert.ok(counts.active >= 4);
    assert.equal(counts.withdrawn, 1);
    assert.equal(counts.completed, 1);
    const rate = computeActivationRate({
      invited: counts.invited,
      activated: counts.activated,
      active: counts.active,
    });
    assert.ok(rate != null && rate > 0);
  });
});

describe("pilotReadinessCore fail-closed", () => {
  it("scenario 1: active patient with no blockers appears ready", () => {
    const r = deriveOverallReadiness(baseReadySnapshot());
    assert.equal(r.overall, "ready");
    assert.equal(r.failClosed, false);
  });

  it("scenario 2: missing mandatory consent appears blocked", () => {
    const r = deriveOverallReadiness(
      baseReadySnapshot({ mandatoryConsentGap: true, consent: "blocked" })
    );
    assert.equal(r.overall, "blocked");
    assert.equal(r.failClosed, true);
  });

  it("scenario 3: unresolved pathology appears clinically blocked", () => {
    const r = deriveOverallReadiness(
      baseReadySnapshot({ pathology: "blocked", clinicalBlockerPresent: true })
    );
    assert.equal(r.overall, "blocked");
  });

  it("scenario 4: unpaid required deposit appears financially blocked", () => {
    const r = deriveOverallReadiness(
      baseReadySnapshot({
        financial: "deposit_pending",
        mandatoryFinancialGateUnmet: true,
      })
    );
    assert.equal(r.overall, "blocked");
  });

  it("scenario 5: optional document does not block readiness", () => {
    assert.equal(
      optionalDocumentDoesNotBlock({
        optionalDocumentMissing: true,
        mandatoryConsentGap: false,
      }),
      true
    );
    const r = deriveOverallReadiness(baseReadySnapshot());
    assert.equal(r.overall, "ready");
  });

  it("scenario 14: clinical blocker overrides other ready states", () => {
    const r = deriveOverallReadiness(
      baseReadySnapshot({ clinical: "blocked", clinicalBlockerPresent: true })
    );
    assert.equal(r.overall, "blocked");
  });

  it("scenario 15: unknown mandatory state is not treated as ready", () => {
    const r = deriveOverallReadiness(baseReadySnapshot({ consent: "unknown" }));
    assert.equal(r.overall, "blocked");
    assert.ok(r.reasons.includes("unknown_mandatory_state") || r.failClosed);
  });

  it("technical attention becomes attention_required, not ready", () => {
    const r = deriveOverallReadiness(baseReadySnapshot({ technicalAttention: true }));
    assert.equal(r.overall, "attention_required");
  });

  it("identity integrity issue blocks overall", () => {
    const r = deriveOverallReadiness(
      baseReadySnapshot({ identityIntegrityBlocked: true })
    );
    assert.equal(r.overall, "blocked");
    assert.equal(r.failClosed, true);
  });
});

describe("pilotBlockerCore escalation", () => {
  it("escalates overdue clinic action to attention", () => {
    const r = deriveEscalationLevel(
      {
        patientActionOverdueHours: null,
        clinicActionOverdueBusinessDays: 2,
        patientInactiveDays: null,
        unreadPatientMessageBusinessHours: null,
        surgeryWithinDays: null,
        missingRequiredConsent: false,
        missingFinancialClearance: false,
        pathologyUnresolved: false,
        identityMismatch: false,
        crossTenantIdentityConcern: false,
        wrongPatientLinkage: false,
        failedNotificationPastRetry: false,
        blockedDays: null,
        readinessIncorrectlyRepresented: false,
        paymentAllocatedWrongPatient: false,
        consentWrongPatient: false,
        patientDataAccessCrossPatient: false,
        procedureMarkedReadyDespiteMandatoryBlocker: false,
      },
      mergeEscalationThresholds()
    );
    assert.equal(r.level, "attention");
  });

  it("escalates cross-tenant identity to critical", () => {
    const r = deriveEscalationLevel({
      patientActionOverdueHours: null,
      clinicActionOverdueBusinessDays: null,
      patientInactiveDays: null,
      unreadPatientMessageBusinessHours: null,
      surgeryWithinDays: null,
      missingRequiredConsent: false,
      missingFinancialClearance: false,
      pathologyUnresolved: false,
      identityMismatch: false,
      crossTenantIdentityConcern: true,
      wrongPatientLinkage: false,
      failedNotificationPastRetry: false,
      blockedDays: null,
      readinessIncorrectlyRepresented: false,
      paymentAllocatedWrongPatient: false,
      consentWrongPatient: false,
      patientDataAccessCrossPatient: false,
      procedureMarkedReadyDespiteMandatoryBlocker: false,
    });
    assert.equal(r.level, "critical");
  });

  it("marks inactive patient as attention", () => {
    const r = deriveEscalationLevel({
      patientActionOverdueHours: null,
      clinicActionOverdueBusinessDays: null,
      patientInactiveDays: 3,
      unreadPatientMessageBusinessHours: null,
      surgeryWithinDays: null,
      missingRequiredConsent: false,
      missingFinancialClearance: false,
      pathologyUnresolved: false,
      identityMismatch: false,
      crossTenantIdentityConcern: false,
      wrongPatientLinkage: false,
      failedNotificationPastRetry: false,
      blockedDays: null,
      readinessIncorrectlyRepresented: false,
      paymentAllocatedWrongPatient: false,
      consentWrongPatient: false,
      patientDataAccessCrossPatient: false,
      procedureMarkedReadyDespiteMandatoryBlocker: false,
    });
    assert.equal(r.level, "attention");
    assert.ok(r.reasons.includes("patient_inactive"));
  });
});

describe("pilotHealthCore", () => {
  it("scenario 16: RED for critical integrity issue (score cannot override)", () => {
    const r = derivePilotHealthVerdict({
      blockers: [syntheticCriticalIntegrityBlocker()],
      dimensions: {
        patientActivationRate: 1,
        journeyProgressing: true,
        actionCompletionHealthy: true,
        clinicalSafetyOk: true,
        financialReadinessHealthy: true,
        communicationResponsive: true,
        technicalCompletionRate: 1,
        dataIntegrityOk: true,
        staffAdoptionHealthy: true,
        exceptionBacklogHealthy: true,
      },
    });
    assert.equal(r.verdict, "RED");
    assert.equal(r.criticalFailClosed, true);
  });

  it("scenario 17: AMBER for excessive unresolved high blockers", () => {
    const highs = Array.from({ length: 6 }, (_, i) => ({
      ...syntheticCriticalIntegrityBlocker(),
      id: `e0000000-0000-4000-8000-00000000010${i}`,
      severity: "high" as const,
      criticalIntegrity: false,
      category: "clinic_action_overdue" as const,
    }));
    const r = derivePilotHealthVerdict({
      blockers: highs,
      dimensions: {
        patientActivationRate: 0.8,
        journeyProgressing: true,
        actionCompletionHealthy: true,
        clinicalSafetyOk: true,
        financialReadinessHealthy: true,
        communicationResponsive: true,
        technicalCompletionRate: 0.99,
        dataIntegrityOk: true,
        staffAdoptionHealthy: true,
        exceptionBacklogHealthy: true,
      },
    });
    assert.equal(r.verdict, "AMBER");
  });

  it("GREEN when within thresholds and no criticals", () => {
    const r = derivePilotHealthVerdict({
      blockers: [],
      dimensions: {
        patientActivationRate: 0.9,
        journeyProgressing: true,
        actionCompletionHealthy: true,
        clinicalSafetyOk: true,
        financialReadinessHealthy: true,
        communicationResponsive: true,
        technicalCompletionRate: 0.99,
        dataIntegrityOk: true,
        staffAdoptionHealthy: true,
        exceptionBacklogHealthy: true,
      },
    });
    assert.equal(r.verdict, "GREEN");
  });
});

describe("pilotSourceBindings", () => {
  it("documents reuse bindings including canonical enrolment", () => {
    assert.ok(PILOT_READINESS_SOURCE_BINDINGS.some((b) => b.dimension === "pilot_membership"));
    assert.ok(
      PILOT_READINESS_SOURCE_BINDINGS.every((b) => b.canonicalTables.length > 0)
    );
  });
});
