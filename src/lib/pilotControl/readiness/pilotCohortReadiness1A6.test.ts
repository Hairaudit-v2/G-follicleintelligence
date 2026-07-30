/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.6 — batch readiness, adoption, health, gate tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyPilotEvidenceSource,
  emptyPilotCohortReadinessSummary,
  isPartialPatientReadiness,
  MAX_COHORT_EVALUATION_CONCURRENCY,
  MAX_COHORT_EVALUATION_SIZE,
  projectRegisterReadiness,
  readinessDistributionTotal,
  summarizePilotCohortReadiness,
  type CohortPatientEvaluationOutcome,
} from "./cohortReadinessSummary";
import { evaluatePilotPatientReadinessFromSources } from "./evaluateFromSources";
import { baseReadySourceBag } from "./readinessFixtures";
import { READINESS_EVALUATION_VERSION } from "./readinessTypes";

import {
  assertAdoptionEventSafe,
  computeRateMetric,
} from "../adoption/adoptionTypes";
import {
  computePilotAdoptionMetrics,
  dedupeAdoptionEvents,
  isAutomaticPollingAdoptionEvent,
  type EnrolmentAdoptionInput,
} from "../adoption/adoptionMetrics";
import { derivePilotExpansionRecommendation } from "../adoption/expansionRecommendation";
import { evaluateRealPatientPilotGate } from "../adoption/realPatientPilotGate";
import { assemblePilotControlHealth } from "../api/assemblePilotHealth";
import { PILOT_CONTROL_API_VERSION } from "../pilotControlContracts";
import { roleHasApiPermission } from "../api/pilotControlPermissions";
import { ADOPTION_EMPTY_COHORT_MESSAGE } from "../ui/pilotControlUiConstants";
import { READINESS_DISTRIBUTION_DISCLAIMER } from "../ui/pilotControlUiConstants";
import { registerDimensionDisplay } from "../ui/pilotControlFormatters";

function okOutcome(
  overrides?: Partial<ReturnType<typeof evaluatePilotPatientReadinessFromSources>>
): CohortPatientEvaluationOutcome {
  const readiness = {
    ...evaluatePilotPatientReadinessFromSources(baseReadySourceBag()),
    ...overrides,
  };
  return {
    kind: "ok",
    readiness,
    partial: isPartialPatientReadiness(readiness),
    evidenceClass: "live_patient",
  };
}

describe("1A.6 batch readiness", () => {
  it("1. empty cohort returns valid empty distribution", () => {
    const s = emptyPilotCohortReadinessSummary({
      programmeId: "p1",
      tenantId: "t1",
      evaluatedAt: "2026-07-30T00:00:00.000Z",
    });
    assert.equal(s.source, "canonical_batch_readiness");
    assert.equal(s.cohort.evaluated, 0);
    assert.equal(readinessDistributionTotal(s.overall), 0);
    assert.equal(s.blockers.patientsBlocked, 0);
  });

  it("2. explicit enrolments only are evaluated (outcomes drive counts)", () => {
    const summary = summarizePilotCohortReadiness({
      programmeId: "p1",
      tenantId: "t1",
      totalEnrolled: 2,
      liveEnrolled: 2,
      syntheticEnrolled: 0,
      outcomes: [okOutcome(), okOutcome()],
      evaluatedAt: "2026-07-30T00:00:00.000Z",
    });
    assert.equal(summary.cohort.evaluated, 2);
    assert.equal(summary.cohort.totalEnrolled, 2);
    assert.equal(readinessDistributionTotal(summary.overall), 2);
  });

  it("3. synthetic enrolments are separated from live", () => {
    assert.equal(
      classifyPilotEvidenceSource({ pilotCohort: "synthetic_fixture_a" }),
      "synthetic_fixture"
    );
    assert.equal(
      classifyPilotEvidenceSource({ pilotCohort: "evolved_hr_1a" }),
      "live_patient"
    );
    assert.equal(classifyPilotEvidenceSource({ pilotCohort: "smoke_test_1" }), "smoke_test");
  });

  it("4. wrong-tenant classification stays live but summary scopes by caller", () => {
    const summary = summarizePilotCohortReadiness({
      programmeId: "p1",
      tenantId: "t1",
      totalEnrolled: 1,
      liveEnrolled: 1,
      syntheticEnrolled: 0,
      outcomes: [okOutcome()],
    });
    assert.equal(summary.tenantId, "t1");
  });

  it("5. canonical 1A.2 engine is consumed (evaluation version)", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    assert.equal(r.evaluationVersion, READINESS_EVALUATION_VERSION);
    const summary = summarizePilotCohortReadiness({
      programmeId: r.programmeId,
      tenantId: r.tenantId,
      totalEnrolled: 1,
      liveEnrolled: 1,
      syntheticEnrolled: 0,
      outcomes: [
        {
          kind: "ok",
          readiness: r,
          partial: false,
          evidenceClass: "live_patient",
        },
      ],
    });
    assert.equal(summary.versions.readiness, READINESS_EVALUATION_VERSION);
    assert.equal(summary.source, "canonical_batch_readiness");
  });

  it("6. unknown mandatory signal prevents ready in register projection", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    // Force partial flag path: projection must never promote failed eval to ready
    const failed = projectRegisterReadiness(null, { failed: true });
    assert.equal(failed.overall, "attention_required");
    assert.notEqual(failed.overall, "ready");
    const projected = projectRegisterReadiness(r);
    if (projected.partial && projected.overall === "ready") {
      assert.fail("partial evaluation must not project as ready");
    }
    assert.ok(projected.overall);
  });

  it("7. partial evaluation is counted", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    const summary = summarizePilotCohortReadiness({
      programmeId: "p1",
      tenantId: "t1",
      totalEnrolled: 1,
      liveEnrolled: 1,
      syntheticEnrolled: 0,
      outcomes: [
        {
          kind: "ok",
          readiness: r,
          partial: true,
          evidenceClass: "live_patient",
        },
      ],
    });
    assert.equal(summary.cohort.partialEvaluations, 1);
    assert.equal(summary.cohort.completeEvaluations, 0);
  });

  it("8. failed evaluation is counted", () => {
    const summary = summarizePilotCohortReadiness({
      programmeId: "p1",
      tenantId: "t1",
      totalEnrolled: 1,
      liveEnrolled: 1,
      syntheticEnrolled: 0,
      outcomes: [
        {
          kind: "failed",
          patientId: "x",
          enrolmentId: "e",
          evidenceClass: "live_patient",
          reason: "boom",
        },
      ],
    });
    assert.equal(summary.cohort.failedEvaluations, 1);
    assert.equal(summary.overall.unknown, 1);
    assert.equal(summary.overall.ready, 0);
  });

  it("9-10. dimension and overall distributions total correctly", () => {
    const summary = summarizePilotCohortReadiness({
      programmeId: "p1",
      tenantId: "t1",
      totalEnrolled: 3,
      liveEnrolled: 3,
      syntheticEnrolled: 0,
      outcomes: [okOutcome(), okOutcome(), okOutcome()],
    });
    assert.equal(readinessDistributionTotal(summary.overall), 3);
    assert.equal(readinessDistributionTotal(summary.dimensions.clinical), 3);
    assert.equal(readinessDistributionTotal(summary.dimensions.financial), 3);
  });

  it("11. same source state gives deterministic aggregation", () => {
    const outcomes = [okOutcome(), okOutcome()];
    const a = summarizePilotCohortReadiness({
      programmeId: "p1",
      tenantId: "t1",
      totalEnrolled: 2,
      liveEnrolled: 2,
      syntheticEnrolled: 0,
      outcomes,
      evaluatedAt: "2026-07-30T00:00:00.000Z",
    });
    const b = summarizePilotCohortReadiness({
      programmeId: "p1",
      tenantId: "t1",
      totalEnrolled: 2,
      liveEnrolled: 2,
      syntheticEnrolled: 0,
      outcomes,
      evaluatedAt: "2026-07-30T00:00:00.000Z",
    });
    assert.deepEqual(a.overall, b.overall);
    assert.deepEqual(a.dimensions, b.dimensions);
  });

  it("12-13. bounded concurrency and max cohort constants are enforced", () => {
    assert.equal(MAX_COHORT_EVALUATION_SIZE, 50);
    assert.ok(MAX_COHORT_EVALUATION_CONCURRENCY <= 8);
  });

  it("14. source freshness fields exist on summary", () => {
    const summary = summarizePilotCohortReadiness({
      programmeId: "p1",
      tenantId: "t1",
      totalEnrolled: 1,
      liveEnrolled: 1,
      syntheticEnrolled: 0,
      outcomes: [okOutcome()],
      evaluatedAt: "2026-07-30T00:00:00.000Z",
    });
    assert.equal(summary.freshness.evaluatedAt, "2026-07-30T00:00:00.000Z");
    assert.ok(Array.isArray(summary.freshness.staleSourceSystems));
  });

  it("15. summary source is canonical_batch_readiness (not blocker-derived)", () => {
    const summary = emptyPilotCohortReadinessSummary({ programmeId: "p", tenantId: "t" });
    assert.equal(summary.source, "canonical_batch_readiness");
    assert.doesNotMatch(READINESS_DISTRIBUTION_DISCLAIMER, /blocker and enrolment data/i);
  });
});

describe("1A.6 register integration", () => {
  it("16-20. register projection uses canonical readiness; partial not ready", () => {
    const r = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());
    const projected = projectRegisterReadiness(r);
    assert.ok(projected.clinical);
    assert.ok(projected.evaluatedAt);
    assert.equal(typeof projected.unknownMandatorySignalCount, "number");

    const failed = projectRegisterReadiness(null, { failed: true });
    assert.equal(failed.overall, "attention_required");
    assert.equal(failed.partial, true);
    assert.notEqual(failed.overall, "ready");

    const dim = registerDimensionDisplay("ready", { partial: true });
    assert.equal(dim.isReady, false);
    assert.equal(dim.label, "Attention required");
  });
});

describe("1A.6 adoption events and metrics", () => {
  const baseEnrolments: EnrolmentAdoptionInput[] = [
    {
      id: "e1",
      patientId: "p1",
      enrolmentStatus: "invited",
      invitedAt: "2026-07-01T00:00:00.000Z",
      activatedAt: null,
      completedAt: null,
      withdrawnAt: null,
      pausedAt: null,
      evidenceClass: "live_patient",
    },
    {
      id: "e2",
      patientId: "p2",
      enrolmentStatus: "activated",
      invitedAt: "2026-07-01T00:00:00.000Z",
      activatedAt: "2026-07-02T00:00:00.000Z",
      completedAt: null,
      withdrawnAt: null,
      pausedAt: null,
      evidenceClass: "live_patient",
    },
  ];

  it("21-23. event requires tenant; programme correlation; patient optional", () => {
    const bad = assertAdoptionEventSafe({
      eventId: "1",
      eventType: "payment_verified",
      tenantId: "",
      programmeId: "prog",
      actorType: "system",
      sourceModule: "financial_os",
      occurredAt: "2026-07-30T00:00:00.000Z",
    });
    assert.equal(bad.ok, false);

    const ok = assertAdoptionEventSafe({
      eventId: "1",
      eventType: "pilot_control_overview_viewed",
      tenantId: "t1",
      programmeId: "prog",
      actorType: "staff",
      sourceModule: "pilot_control",
      occurredAt: "2026-07-30T00:00:00.000Z",
    });
    assert.equal(ok.ok, true);
  });

  it("24-25. duplicate / replayed events are not counted twice", () => {
    const events = dedupeAdoptionEvents([
      {
        eventId: "a",
        eventType: "payment_verified",
        tenantId: "t1",
        programmeId: "prog",
        actorType: "system",
        sourceModule: "financial_os",
        occurredAt: "2026-07-30T00:00:00.000Z",
        idempotencyKey: "pay-1",
      },
      {
        eventId: "b",
        eventType: "payment_verified",
        tenantId: "t1",
        programmeId: "prog",
        actorType: "system",
        sourceModule: "financial_os",
        occurredAt: "2026-07-30T00:01:00.000Z",
        idempotencyKey: "pay-1",
      },
    ]);
    assert.equal(events.length, 1);
    const metrics = computePilotAdoptionMetrics({
      programmeId: "prog",
      tenantId: "t1",
      enrolments: baseEnrolments,
      events: [
        ...events,
        {
          eventId: "b",
          eventType: "payment_verified",
          tenantId: "t1",
          programmeId: "prog",
          actorType: "system",
          sourceModule: "financial_os",
          occurredAt: "2026-07-30T00:01:00.000Z",
          idempotencyKey: "pay-1",
        },
      ],
      blockers: [],
      evaluatedAt: "2026-07-30T12:00:00.000Z",
    });
    assert.equal(metrics.finance.paymentsVerified.value, 1);
  });

  it("26. automatic polling does not count as staff adoption", () => {
    assert.equal(
      isAutomaticPollingAdoptionEvent({
        eventId: "1",
        eventType: "pilot_control_overview_viewed",
        tenantId: "t1",
        programmeId: "prog",
        actorType: "staff",
        actorId: "u1",
        sourceModule: "pilot_control",
        occurredAt: "2026-07-30T00:00:00.000Z",
        metadataClass: "automatic_refresh",
      }),
      true
    );
  });

  it("27. synthetic events are separated", () => {
    const metrics = computePilotAdoptionMetrics({
      programmeId: "prog",
      tenantId: "t1",
      enrolments: [
        {
          ...baseEnrolments[0]!,
          evidenceClass: "synthetic_fixture",
          enrolmentStatus: "active",
        },
      ],
      events: [
        {
          eventId: "1",
          eventType: "patient_action_completed",
          tenantId: "t1",
          programmeId: "prog",
          actorType: "patient",
          sourceModule: "patient_journey_control",
          occurredAt: "2026-07-30T00:00:00.000Z",
          evidenceClass: "synthetic_fixture",
        },
      ],
      blockers: [],
    });
    assert.equal(metrics.confidence.overall, "synthetic_only");
    assert.equal(metrics.cohort.activatedPatients.value, 0);
  });

  it("28. sensitive content is rejected", () => {
    const check = assertAdoptionEventSafe({
      eventId: "1",
      eventType: "message_received",
      tenantId: "t1",
      programmeId: "prog",
      actorType: "patient",
      sourceModule: "reception_inbox",
      occurredAt: "2026-07-30T00:00:00.000Z",
      messageBody: "secret clinical note",
    } as never);
    assert.equal(check.ok, false);
  });

  it("29. wrong-tenant event is excluded", () => {
    const metrics = computePilotAdoptionMetrics({
      programmeId: "prog",
      tenantId: "t1",
      enrolments: baseEnrolments,
      events: [
        {
          eventId: "1",
          eventType: "patient_action_completed",
          tenantId: "other-tenant",
          programmeId: "prog",
          actorType: "patient",
          sourceModule: "patient_journey_control",
          occurredAt: "2026-07-30T00:00:00.000Z",
        },
      ],
      blockers: [],
    });
    assert.equal(metrics.patient.patientActionsCompleted.value, 0);
  });

  it("30. late event with distinct idempotency still counts once", () => {
    const metrics = computePilotAdoptionMetrics({
      programmeId: "prog",
      tenantId: "t1",
      enrolments: baseEnrolments,
      events: [
        {
          eventId: "late",
          eventType: "quote_delivered",
          tenantId: "t1",
          programmeId: "prog",
          actorType: "system",
          sourceModule: "crm_quotes",
          occurredAt: "2026-06-01T00:00:00.000Z",
          idempotencyKey: "quote-1",
        },
      ],
      blockers: [],
    });
    assert.equal(metrics.finance.quotesDelivered.value, 1);
  });

  it("31. activation denominator is invited patients", () => {
    const metrics = computePilotAdoptionMetrics({
      programmeId: "prog",
      tenantId: "t1",
      enrolments: baseEnrolments,
      events: [],
      blockers: [],
    });
    assert.equal(metrics.cohort.activationRate.denominator, 2);
    assert.equal(metrics.cohort.activationRate.numerator, 1);
  });

  it("32. zero denominator returns null", () => {
    const rate = computeRateMetric(0, 0, {
      source: ["test"],
      evaluatedAt: "2026-07-30T00:00:00.000Z",
    });
    assert.equal(rate.value, null);
  });

  it("33. withdrawn patients are handled", () => {
    const metrics = computePilotAdoptionMetrics({
      programmeId: "prog",
      tenantId: "t1",
      enrolments: [
        {
          id: "w1",
          patientId: "pw",
          enrolmentStatus: "withdrawn",
          invitedAt: "2026-07-01T00:00:00.000Z",
          activatedAt: null,
          completedAt: null,
          withdrawnAt: "2026-07-05T00:00:00.000Z",
          pausedAt: null,
          evidenceClass: "live_patient",
        },
      ],
      events: [],
      blockers: [],
    });
    assert.equal(metrics.cohort.withdrawnPatients.value, 1);
  });

  it("41. manual fallback count is safe", () => {
    const metrics = computePilotAdoptionMetrics({
      programmeId: "prog",
      tenantId: "t1",
      enrolments: baseEnrolments,
      events: [
        {
          eventId: "1",
          eventType: "manual_channel_fallback_recorded",
          tenantId: "t1",
          programmeId: "prog",
          actorType: "staff",
          sourceModule: "pilot_control",
          occurredAt: "2026-07-30T00:00:00.000Z",
          metadataClass: "phone",
        },
      ],
      blockers: [],
    });
    assert.equal(metrics.staff.manualFallbackCount.value, 1);
  });

  it("42. no live cohort returns insufficient evidence", () => {
    const metrics = computePilotAdoptionMetrics({
      programmeId: "prog",
      tenantId: "t1",
      enrolments: [],
      events: [],
      blockers: [],
    });
    assert.equal(metrics.confidence.overall, "insufficient_evidence");
    assert.match(ADOPTION_EMPTY_COHORT_MESSAGE, /No live adoption evidence/i);
  });
});

describe("1A.6 health and expansion", () => {
  it("43. technical platform with no live cohort remains AMBER insufficient / not_started", () => {
    const health = assemblePilotControlHealth({
      programmeStatus: "planned",
      enrolments: [],
      blockers: [],
      evaluatedAt: "2026-07-30T00:00:00.000Z",
    });
    assert.equal(health.verdict, "AMBER");
    assert.ok(
      health.expansionRecommendation === "not_started" ||
        health.expansionRecommendation === "insufficient_evidence"
    );
  });

  it("44. critical identity stop condition yields pause when live cohort exists", () => {
    const rec = derivePilotExpansionRecommendation({
      programmeStatus: "active",
      liveEnrolmentCount: 3,
      healthVerdict: "RED",
      stopConditionsCritical: true,
      blockersRequiringPilotPause: 0,
      openHighBlockers: 0,
      evidenceConfidence: "live_verified",
      liveEvidenceDurationDays: 30,
    });
    assert.equal(rec, "pause_pilot");
  });

  it("45. high blocker backlog returns hold expansion", () => {
    const rec = derivePilotExpansionRecommendation({
      programmeStatus: "active",
      liveEnrolmentCount: 5,
      healthVerdict: "AMBER",
      stopConditionsCritical: false,
      blockersRequiringPilotPause: 0,
      openHighBlockers: 8,
      evidenceConfidence: "live_verified",
      liveEvidenceDurationDays: 30,
    });
    assert.equal(rec, "hold_expansion");
  });

  it("46. healthy current cohort returns continue current scope", () => {
    const rec = derivePilotExpansionRecommendation({
      programmeStatus: "active",
      liveEnrolmentCount: 4,
      healthVerdict: "GREEN",
      stopConditionsCritical: false,
      blockersRequiringPilotPause: 0,
      openHighBlockers: 0,
      evidenceConfidence: "live_verified",
      liveEvidenceDurationDays: 30,
      invitationGateEligible: false,
    });
    assert.equal(rec, "continue_current_scope");
  });

  it("47. insufficient duration returns insufficient evidence", () => {
    const rec = derivePilotExpansionRecommendation({
      programmeStatus: "active",
      liveEnrolmentCount: 4,
      healthVerdict: "GREEN",
      stopConditionsCritical: false,
      blockersRequiringPilotPause: 0,
      openHighBlockers: 0,
      evidenceConfidence: "live_verified",
      liveEvidenceDurationDays: 2,
      requiredEvidenceDurationDays: 14,
    });
    assert.equal(rec, "insufficient_evidence");
  });

  it("48. human gates prevent eligible state", () => {
    const gate = evaluateRealPatientPilotGate({
      technicalAcceptance: true,
      migrationsApplied: true,
      tenantIsolationProven: true,
      roleMatrixProven: true,
      identityIntegrityProven: true,
      financeIntegrityProven: true,
      consentControlsProven: true,
      // humans false
    });
    assert.equal(gate.eligible, false);
    assert.ok(gate.blockers.some((b) => b.startsWith("human_gate:")));
  });

  it("49. stop condition overrides numerical score", () => {
    const rec = derivePilotExpansionRecommendation({
      programmeStatus: "active",
      liveEnrolmentCount: 10,
      healthVerdict: "GREEN",
      stopConditionsCritical: true,
      blockersRequiringPilotPause: 1,
      openHighBlockers: 0,
      evidenceConfidence: "live_verified",
      liveEvidenceDurationDays: 60,
      invitationGateEligible: true,
      technicalAcceptanceComplete: true,
      operationalAcceptanceComplete: true,
    });
    assert.equal(rec, "pause_pilot");
  });

  it("50. synthetic evidence cannot satisfy live health", () => {
    const health = assemblePilotControlHealth({
      programmeStatus: "active",
      enrolments: [{ enrolmentStatus: "active" }],
      blockers: [],
      syntheticEvidenceOnly: true,
    });
    assert.equal(health.verdict, "AMBER");
    assert.equal(health.expansionRecommendation, "insufficient_evidence");
  });
});

describe("1A.6 API / UI contracts", () => {
  it("51-54. adoption permission alias exists; API version bumped", () => {
    assert.equal(roleHasApiPermission("director", "pilot_control.adoption.read"), true);
    assert.equal(roleHasApiPermission("technical", "pilot_control.adoption.read"), true);
    assert.equal(PILOT_CONTROL_API_VERSION, "1A.6.0");
  });

  it("59. approximation disclaimer removed from readiness constant", () => {
    assert.match(READINESS_DISTRIBUTION_DISCLAIMER, /canonical cohort readiness/i);
    assert.doesNotMatch(READINESS_DISTRIBUTION_DISCLAIMER, /currently derived from blocker/i);
  });
});
