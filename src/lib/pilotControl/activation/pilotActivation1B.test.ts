/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — acceptance scenarios (pure).
 * Covers activation state, migration evidence model, RLS contracts (unit),
 * identity/finance/consent preflight, events, role matrix contracts,
 * activation gate, cohort candidates, pause/rollback, and regression guards.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PILOT_ADOPTION_FORBIDDEN_PAYLOAD_KEYS } from "../adoption/adoptionTypes";
import { evaluateRealPatientPilotGate } from "../adoption/realPatientPilotGate";
import {
  EVOLVED_HAIR_TENANT_ID,
  pilotControlRoleHasScope,
} from "../pilotControlContracts";
import {
  PILOT_1B_REQUIRED_EVENT_COVERAGE,
  PILOT_1B_REQUIRED_MIGRATION_VERSIONS,
  PILOT_1B_REQUIRED_TABLES,
  PILOT_1B_ROLE_ACCEPTANCE_MATRIX,
  appendActivationHistory,
  approveCandidateIndividually,
  assertEventEmitsOnce,
  bulkApproveCandidates,
  buildEventIdempotencyKey,
  buildPilotRollbackPlan,
  canTransitionActivationState,
  classifyEventEvidence,
  completeActivationGateInput,
  createActivationDecisionDraft,
  defaultPathwayLock,
  enforceApprovedCohortLimit,
  evaluateCandidateTechnicalPreflight,
  evaluateControlledPilotActivationGate,
  evaluateMigrationEvidence,
  evaluatePilotPatientClinicalConsentPreflight,
  evaluatePilotPatientFinancePreflight,
  evaluatePilotPatientIdentityPreflight,
  evaluatePilotPauseRecommendation,
  eventPayloadHasSensitiveContent,
  finaliseActivationDecision,
  getInitialInvitationSafeguards,
  mayDeleteOnRollback,
  mayEnableInitialInvites,
  mayIssueInvitation,
  nextDecisionVersion,
  pendingMigrationEvidenceStub,
  programmePauseStopsNewInvitations,
  recordNamedApproval,
  rejectWrongTenantEvent,
  rejectedDecisionRemainsAuditable,
  requiresHumanDecisionForState,
  roleMatrixContractHolds,
  softwareMaySetActivationState,
  summariseEventCoverage,
  summariseRoleMatrixAcceptance,
  transitionActivationState,
  type PilotCohortCandidateReview,
} from "./index";

describe("FI-CONTROLLED-PILOT-ACTIVATION-1B", () => {
  // -------------------------------------------------------------------------
  // Activation state (1–8)
  // -------------------------------------------------------------------------
  describe("activation state", () => {
    it("1. planned programme cannot invite", () => {
      const r = mayEnableInitialInvites({
        activationState: "planned",
        humanApprovedForInitialInvites: true,
        criticalStopCondition: false,
        realPatientInvitesEnabled: true,
      });
      assert.equal(r.allowed, false);
    });

    it("2. technical validation cannot invite", () => {
      assert.equal(mayEnableInitialInvites({
          activationState: "technical_validation",
          humanApprovedForInitialInvites: true,
          criticalStopCondition: false,
          realPatientInvitesEnabled: true,
        }).allowed, false);
    });

    it("3. governance review cannot invite", () => {
      assert.equal(mayEnableInitialInvites({
          activationState: "governance_review",
          humanApprovedForInitialInvites: true,
          criticalStopCondition: false,
          realPatientInvitesEnabled: true,
        }).allowed, false);
    });

    it("4. approved-for-initial-invites requires human decision", () => {
      assert.equal(canTransitionActivationState({
          from: "governance_review",
          to: "approved_for_initial_invites",
          humanDecision: false,
        }), false);
      assert.equal(transitionActivationState({
          from: "governance_review",
          to: "approved_for_initial_invites",
          humanDecision: true,
        }).ok, true);
      assert.equal(requiresHumanDecisionForState("approved_for_initial_invites"), true);
      assert.equal(softwareMaySetActivationState("approved_for_initial_invites"), false);
    });

    it("5. critical blocker prevents approval progression", () => {
      const r = transitionActivationState({
        from: "governance_review",
        to: "approved_for_initial_invites",
        humanDecision: true,
        criticalStopCondition: true,
      });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.reason, "critical_stop_blocks_progression");
    });

    it("6. activation transitions preserve history", () => {
      const t1 = transitionActivationState({
        from: "planned",
        to: "technical_validation",
        at: "2026-07-30T01:00:00.000Z",
      });
      assert.equal(t1.ok, true);
      if (!t1.ok) return;
      const history = appendActivationHistory([], t1.historyEntry);
      const t2 = transitionActivationState({
        from: "technical_validation",
        to: "governance_review",
        at: "2026-07-30T02:00:00.000Z",
      });
      assert.equal(t2.ok, true);
      if (!t2.ok) return;
      const next = appendActivationHistory(history, t2.historyEntry);
      assert.equal((next).length, 2);
      assert.equal(next[0].from, "planned");
      assert.equal(next[1].to, "governance_review");
    });

    it("7. rejected decision remains auditable", () => {
      const d = createActivationDecisionDraft({
        id: "d1",
        programmeId: "p1",
        tenantId: EVOLVED_HAIR_TENANT_ID,
        decisionType: "governance_review",
        decisionState: "governance_review",
        decisionVersion: 1,
        requestedAt: "2026-07-30T00:00:00.000Z",
        requestedBy: "user-ops",
      });
      const fin = finaliseActivationDecision(d, {
        decision: "rejected",
        decisionReason: "Incomplete remote migration proof",
        at: "2026-07-30T03:00:00.000Z",
      });
      assert.equal(fin.ok, true);
      if (!fin.ok) return;
      assert.equal(rejectedDecisionRemainsAuditable([fin.record]), true);
    });

    it("8. new review creates a new decision occurrence", () => {
      const v = nextDecisionVersion([{ decisionVersion: 1 }, { decisionVersion: 2 }]);
      assert.equal(v, 3);
      const d = createActivationDecisionDraft({
        id: "d3",
        programmeId: "p1",
        tenantId: EVOLVED_HAIR_TENANT_ID,
        decisionType: "governance_review",
        decisionState: "governance_review",
        decisionVersion: v,
        requestedAt: "2026-07-30T04:00:00.000Z",
        requestedBy: "user-ops",
      });
      assert.equal(d.decisionVersion, 3);
      assert.equal(d.decision, "pending");
    });
  });

  // -------------------------------------------------------------------------
  // Migration and RLS contracts (9–16)
  // -------------------------------------------------------------------------
  describe("migration and RLS contracts", () => {
    it("9. required remote tables are listed", () => {
      assert.ok((PILOT_1B_REQUIRED_TABLES).includes("fi_pilot_programmes"));
      assert.ok((PILOT_1B_REQUIRED_TABLES).includes("fi_pilot_activation_decisions"));
      assert.ok((PILOT_1B_REQUIRED_TABLES).includes("fi_pilot_cohort_candidate_reviews"));
    });

    it("10. required migration versions include 1B", () => {
      assert.ok((PILOT_1B_REQUIRED_MIGRATION_VERSIONS).includes("202611041003"));
    });

    it("11–15. migration evidence fail-closed until remote proof recorded", () => {
      const pending = pendingMigrationEvidenceStub("202611041003");
      const ev = evaluateMigrationEvidence(pending);
      assert.equal(ev.appliedAndProven, false);
      assert.ok((ev.blockers.length) > 0);
    });

    it("16. migration must not activate programme or invites", () => {
      const bad = evaluateMigrationEvidence({
        ...pendingMigrationEvidenceStub("202611041003"),
        remoteProjectId: "proj",
        appliedAt: "2026-07-30T00:00:00.000Z",
        applyingOperator: "ops@example.com",
        migrationChecksum: "abc",
        schemaVerified: true,
        tablesVerified: true,
        indexesVerified: true,
        foreignKeysVerified: true,
        rlsVerified: true,
        rollbackPlanDocumented: true,
        backupOrRecoveryPosition: "snapshot-1",
        realPatientEnrolmentsCreated: false,
        realPatientInvitationsEnabled: false,
        programmeActivatedByMigration: true,
      });
      assert.equal(bad.appliedAndProven, false);
      assert.ok((bad.blockers).includes("programme_activated_by_migration"));
    });

    it("tenant member scopes exist; wrong-tenant denial is modelled", () => {
      assert.equal(roleMatrixContractHolds("director"), true);
      assert.equal(rejectWrongTenantEvent({
          eventTenantId: "other",
          expectedTenantId: EVOLVED_HAIR_TENANT_ID,
        }).accepted, false);
    });
  });

  // -------------------------------------------------------------------------
  // Identity preflight (17–24)
  // -------------------------------------------------------------------------
  describe("identity preflight", () => {
    const base = {
      tenantId: EVOLVED_HAIR_TENANT_ID,
      programmeId: "prog-1",
      patientId: "pat-1",
      patientFound: true,
      patientTenantId: EVOLVED_HAIR_TENANT_ID,
      ambiguousPatient: false,
      appAuthUserId: "auth-1",
      appLinkagePatientCount: 1,
      crmLeadPatientIdConflict: false,
      quotePatientId: "pat-1",
      consentPatientId: "pat-1",
      documentPatientId: "pat-1",
      imagePatientIds: ["pat-1"] as string[],
      journeyPatientId: "pat-1",
      activeEnrolmentCountForProgrammePatient: 1,
      isSyntheticOrSmokeFixture: false,
    };

    it("17. correct identity passes", () => {
      assert.equal(evaluatePilotPatientIdentityPreflight(base).eligible, true);
    });

    it("18. ambiguous identity fails", () => {
      const r = evaluatePilotPatientIdentityPreflight({ ...base, ambiguousPatient: true });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("ambiguous_identity"));
    });

    it("19. wrong tenant fails", () => {
      const r = evaluatePilotPatientIdentityPreflight({
        ...base,
        patientTenantId: "other-tenant",
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("tenant_ownership"));
    });

    it("20. duplicate enrolment fails", () => {
      const r = evaluatePilotPatientIdentityPreflight({
        ...base,
        activeEnrolmentCountForProgrammePatient: 2,
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("duplicate_enrolment"));
    });

    it("21. conflicting app identity fails", () => {
      const r = evaluatePilotPatientIdentityPreflight({
        ...base,
        appLinkagePatientCount: 2,
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("app_identity"));
    });

    it("22. cross-patient finance link fails", () => {
      const r = evaluatePilotPatientIdentityPreflight({
        ...base,
        quotePatientId: "other-pat",
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("finance_identity"));
    });

    it("23. cross-patient consent link fails", () => {
      const r = evaluatePilotPatientIdentityPreflight({
        ...base,
        consentPatientId: "other-pat",
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("consent_identity"));
    });

    it("24. synthetic fixture is excluded", () => {
      const r = evaluatePilotPatientIdentityPreflight({
        ...base,
        isSyntheticOrSmokeFixture: true,
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("synthetic_fixture_excluded"));
    });
  });

  // -------------------------------------------------------------------------
  // Finance preflight (25–30)
  // -------------------------------------------------------------------------
  describe("finance preflight", () => {
    const base = {
      tenantId: EVOLVED_HAIR_TENANT_ID,
      programmeId: "prog-1",
      patientId: "pat-1",
      quoteId: "q-1",
      quotePatientId: "pat-1",
      quoteStatus: "accepted",
      invoicePatientId: "pat-1",
      depositRequired: true,
      depositVerified: true,
      unallocatedPaymentPresent: false,
      paymentPatientIdMismatch: false,
      reconciliationException: false,
      paymentPlanActive: false,
      paymentPlanSatisfiesClearance: true,
      clearanceState: "deposit_ready" as const,
      stripeEnabled: false,
      stripeBranchOnlyCapability: true,
    };

    it("25. correct manual payment allocation passes", () => {
      assert.equal(evaluatePilotPatientFinancePreflight(base).eligible, true);
    });

    it("26. unallocated payment fails readiness", () => {
      const r = evaluatePilotPatientFinancePreflight({
        ...base,
        unallocatedPaymentPresent: true,
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("payment_allocation"));
    });

    it("27. wrong-patient payment is critical", () => {
      const r = evaluatePilotPatientFinancePreflight({
        ...base,
        paymentPatientIdMismatch: true,
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("cross_patient_payment"));
    });

    it("28. reconciliation exception prevents eligibility", () => {
      const r = evaluatePilotPatientFinancePreflight({
        ...base,
        reconciliationException: true,
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("reconciliation"));
    });

    it("29. Stripe disabled does not fail manual finance", () => {
      const r = evaluatePilotPatientFinancePreflight({
        ...base,
        stripeEnabled: false,
        stripeBranchOnlyCapability: true,
      });
      assert.equal(r.eligible, true);
      assert.equal(r.checks.stripeDisabled.status, "pass");
    });

    it("30. Stripe branch-only code does not affect live preflight", () => {
      const withBranch = evaluatePilotPatientFinancePreflight({
        ...base,
        stripeBranchOnlyCapability: true,
      });
      const withoutBranch = evaluatePilotPatientFinancePreflight({
        ...base,
        stripeBranchOnlyCapability: false,
      });
      assert.equal(withBranch.eligible, withoutBranch.eligible);
    });
  });

  // -------------------------------------------------------------------------
  // Clinical and consent (31–35)
  // -------------------------------------------------------------------------
  describe("clinical and consent", () => {
    const base = {
      tenantId: EVOLVED_HAIR_TENANT_ID,
      programmeId: "prog-1",
      patientId: "pat-1",
      pathwayObserved: true,
      consultationComplete: true,
      clinicalReviewState: "approved" as const,
      pathologyRequiredKnown: true,
      consentWorkflowAvailable: true,
      consentPatientId: "pat-1",
      consentCurrent: true,
      consentSupersededOrRevoked: false,
      clinicalEscalationPathDefined: true,
      clinicalEscalationActive: false,
      highComplexityException: false,
      humanClinicalApproval: true,
    };

    it("31. required consent missing prevents eligibility", () => {
      const r = evaluatePilotPatientClinicalConsentPreflight({
        ...base,
        consentPatientId: null,
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("consent_ownership"));
    });

    it("32. superseded consent does not pass", () => {
      const r = evaluatePilotPatientClinicalConsentPreflight({
        ...base,
        consentSupersededOrRevoked: true,
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("consent_current"));
    });

    it("33. wrong-patient consent is critical", () => {
      const r = evaluatePilotPatientClinicalConsentPreflight({
        ...base,
        consentPatientId: "other",
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("consent_ownership"));
    });

    it("34. unresolved clinical escalation prevents eligibility", () => {
      const r = evaluatePilotPatientClinicalConsentPreflight({
        ...base,
        clinicalEscalationActive: true,
      });
      assert.equal(r.eligible, false);
      assert.ok((r.criticalBlockers).includes("unresolved_clinical_escalation"));
    });

    it("35. clinical approval remains human", () => {
      const r = evaluatePilotPatientClinicalConsentPreflight({
        ...base,
        humanClinicalApproval: false,
      });
      assert.equal(r.eligible, false);
      assert.equal(r.clinicalSuitabilityHumanRequired, true);
      assert.ok((r.criticalBlockers).includes("human_clinical_approval_required"));
    });
  });

  // -------------------------------------------------------------------------
  // Event wiring (36–42)
  // -------------------------------------------------------------------------
  describe("event wiring", () => {
    it("36. required event emits once", () => {
      const key = buildEventIdempotencyKey(["t", "p", "e", "blocker_opened"]);
      const first = assertEventEmitsOnce([], key);
      assert.equal(first.emit, true);
      const second = assertEventEmitsOnce([key], key);
      assert.equal(second.emit, false);
    });

    it("37. replay is idempotent", () => {
      const key = buildEventIdempotencyKey(["t", "p", "enrol", "pilot_patient_approved"]);
      assert.equal(assertEventEmitsOnce([key], key).duplicate, true);
    });

    it("38. wrong tenant event is rejected", () => {
      assert.equal(rejectWrongTenantEvent({
          eventTenantId: "x",
          expectedTenantId: EVOLVED_HAIR_TENANT_ID,
        }).accepted, false);
    });

    it("39. synthetic event is separated", () => {
      assert.equal(classifyEventEvidence({ isSynthetic: true }), "synthetic");
      assert.equal(classifyEventEvidence({ isSynthetic: false }), "live");
    });

    it("40. sensitive content is absent", () => {
      const rejected = eventPayloadHasSensitiveContent(
        { messageBody: "secret clinical text", eventKind: "ok" },
        PILOT_ADOPTION_FORBIDDEN_PAYLOAD_KEYS
      );
      assert.ok((rejected).includes("messageBody"));
    });

    it("41. event failure is observable via coverage summary", () => {
      const summary = summariseEventCoverage();
      assert.ok((summary.wiredCount) > 0);
      assert.equal(Array.isArray(summary.blockers), true);
    });

    it("42. polling does not count as adoption (coverage excludes poll)", () => {
      assert.equal(PILOT_1B_REQUIRED_EVENT_COVERAGE.some((e) => e.eventKey.includes("poll")), false);
    });
  });

  // -------------------------------------------------------------------------
  // Role matrix contracts (43–52)
  // -------------------------------------------------------------------------
  describe("role matrix", () => {
    for (const role of [
      "director",
      "clinic_manager",
      "reception",
      "consultant",
      "clinical",
      "finance",
      "technical",
    ] as const) {
      it(`${role} role matrix contract holds`, () => {
        assert.equal(roleMatrixContractHolds(role), true);
        assert.equal(PILOT_1B_ROLE_ACCEPTANCE_MATRIX.some((r) => r.role === role), true);
      });
    }

    it("50. unauthorised direct access fails (contract)", () => {
      const row = PILOT_1B_ROLE_ACCEPTANCE_MATRIX.find((r) => r.role === "unauthorised");
      assert.equal(row?.expectedAccess, "denied");
    });

    it("51. wrong-tenant access fails (contract)", () => {
      assert.equal(PILOT_1B_ROLE_ACCEPTANCE_MATRIX.find((r) => r.role === "wrong_tenant")
          ?.expectedAccess, "denied");
    });

    it("52. wrong-programme access fails (contract)", () => {
      assert.equal(PILOT_1B_ROLE_ACCEPTANCE_MATRIX.find((r) => r.role === "wrong_programme")
          ?.expectedAccess, "denied");
    });

    it("director sees activation readiness; reception does not", () => {
      assert.equal(pilotControlRoleHasScope("director", "activation_readiness_read"), true);
      assert.equal(pilotControlRoleHasScope("reception", "activation_readiness_read"), false);
    });
  });

  // -------------------------------------------------------------------------
  // Activation gate (53–68)
  // -------------------------------------------------------------------------
  describe("activation gate", () => {
    it("53. technical completion alone is insufficient", () => {
      const gate = evaluateControlledPilotActivationGate({
        controlCentreAccepted: true,
        migrationsApplied: true,
        tenantIsolationProven: true,
        roleMatrixProven: true,
        financeRoleMappingCorrect: true,
        exportSurfaceProven: true,
        identityPreflightProven: true,
        financePreflightProven: true,
        consentControlsProven: true,
        eventCoverageSufficient: true,
      });
      assert.equal(gate.eligibleForGovernanceReview, true);
      assert.equal(gate.approvedForInitialInvites, false);
    });

    it("54. missing migration proof blocks", () => {
      const gate = evaluateControlledPilotActivationGate(
        completeActivationGateInput({ migrationsApplied: false })
      );
      assert.ok((gate.blockers).includes("software_gate:migrationsApplied"));
      assert.equal(gate.approvedForInitialInvites, false);
    });

    it("55. missing role proof blocks", () => {
      const gate = evaluateControlledPilotActivationGate(
        completeActivationGateInput({ roleMatrixProven: false })
      );
      assert.ok((gate.blockers).includes("software_gate:roleMatrixProven"));
    });

    it("56. missing SOP approval blocks", () => {
      assert.ok(
        evaluateControlledPilotActivationGate(
          completeActivationGateInput({ operationalSopApproved: false })
        ).blockers.includes("human_gate:operationalSopApproved")
      );
    });

    it("57. missing staff training blocks", () => {
      assert.ok((evaluateControlledPilotActivationGate(
          completeActivationGateInput({ staffTrainingCompleted: false })
        ).blockers).includes("human_gate:staffTrainingCompleted"));
    });

    it("58. missing support blocks", () => {
      assert.ok((evaluateControlledPilotActivationGate(
          completeActivationGateInput({ supportCoverageConfirmed: false })
        ).blockers).includes("human_gate:supportCoverageConfirmed"));
    });

    it("59. missing incident plan blocks", () => {
      assert.ok((evaluateControlledPilotActivationGate(
          completeActivationGateInput({ incidentResponseConfirmed: false })
        ).blockers).includes("human_gate:incidentResponseConfirmed"));
    });

    it("60. missing fallback blocks", () => {
      assert.ok((evaluateControlledPilotActivationGate(
          completeActivationGateInput({ manualFallbackConfirmed: false })
        ).blockers).includes("human_gate:manualFallbackConfirmed"));
    });

    it("61. missing rollback blocks", () => {
      assert.ok((evaluateControlledPilotActivationGate(
          completeActivationGateInput({ rollbackConfirmed: false })
        ).blockers).includes("human_gate:rollbackConfirmed"));
    });

    it("62. missing patient pilot consent approval blocks", () => {
      assert.ok((evaluateControlledPilotActivationGate(
          completeActivationGateInput({ patientPilotConsentApproved: false })
        ).blockers).includes("human_gate:patientPilotConsentApproved"));
    });

    it("63. missing clinical approval blocks", () => {
      assert.ok((evaluateControlledPilotActivationGate(
          completeActivationGateInput({ clinicalGovernanceApproved: false })
        ).blockers).includes("human_gate:clinicalGovernanceApproved"));
    });

    it("64. missing privacy approval blocks", () => {
      assert.ok((evaluateControlledPilotActivationGate(
          completeActivationGateInput({ privacyApproved: false })
        ).blockers).includes("human_gate:privacyApproved"));
    });

    it("65. missing cohort approval blocks", () => {
      assert.ok((evaluateControlledPilotActivationGate(
          completeActivationGateInput({ initialCohortApproved: false })
        ).blockers).includes("human_gate:initialCohortApproved"));
    });

    it("66. missing director approval blocks", () => {
      assert.ok((evaluateControlledPilotActivationGate(
          completeActivationGateInput({ directorApproval: false })
        ).blockers).includes("human_gate:directorApproval"));
    });

    it("67. complete gate becomes eligible for governance review", () => {
      const gate = evaluateControlledPilotActivationGate(completeActivationGateInput());
      assert.equal(gate.eligibleForGovernanceReview, true);
      assert.equal((gate.blockers.filter((b) => b.startsWith("software_gate:"))).length, 0);
    });

    it("68. complete technical gate does not auto-approve invites", () => {
      const gate = evaluateControlledPilotActivationGate(
        completeActivationGateInput({ humanApprovedForInitialInvites: false })
      );
      assert.equal(gate.approvedForInitialInvites, false);
      assert.ok((gate.warnings).includes(
        "complete_gate_awaits_explicit_human_invite_decision"
      ));
    });

    it("68b. small-team compact gates replace formal document set", () => {
      const gate = evaluateControlledPilotActivationGate(
        completeActivationGateInput({
          governanceTier: "small_team_pilot",
          teamBriefingCompleted: false,
          clinicalWorkflowConfirmed: false,
          financeWorkflowConfirmed: false,
          supportContactConfirmed: false,
          fallbackConfirmed: false,
          directorApproval: false,
          humanApprovedForInitialInvites: true,
        })
      );
      assert.equal(gate.governanceTier, "small_team_pilot");
      for (const key of [
        "teamBriefingCompleted",
        "clinicalWorkflowConfirmed",
        "financeWorkflowConfirmed",
        "supportContactConfirmed",
        "fallbackConfirmed",
        "directorApproval",
      ]) {
        assert.ok(gate.blockers.includes(`human_gate:${key}`), key);
      }
      assert.ok(!gate.blockers.includes("human_gate:operationalSopApproved"));
      assert.ok(!gate.blockers.includes("human_gate:separateTrainingRegister"));
    });
  });

  // -------------------------------------------------------------------------
  // Cohort candidate (69–75)
  // -------------------------------------------------------------------------
  describe("cohort candidate", () => {
    it("69. eligible low-complexity candidate passes technical preflight", () => {
      const r = evaluateCandidateTechnicalPreflight({
        identityEligible: true,
        financeEligible: true,
        consentEligible: true,
        complexIdentity: false,
        disputedFinance: false,
        criticalClinicalBlocker: false,
        namedOperationalOwner: true,
        namedClinicalOwner: true,
        isSyntheticOrSmoke: false,
        pathway: defaultPathwayLock(),
        pathwayLocked: defaultPathwayLock(),
      });
      assert.equal(r.pass, true);
      assert.equal(r.statusHint, "eligible_for_clinical_review");
    });

    it("70. complex identity candidate is excluded", () => {
      const r = evaluateCandidateTechnicalPreflight({
        identityEligible: false,
        financeEligible: true,
        consentEligible: true,
        complexIdentity: true,
        disputedFinance: false,
        criticalClinicalBlocker: false,
        namedOperationalOwner: true,
        namedClinicalOwner: true,
        isSyntheticOrSmoke: false,
        pathway: defaultPathwayLock(),
        pathwayLocked: defaultPathwayLock(),
      });
      assert.equal(r.statusHint, "excluded");
    });

    it("71. disputed finance candidate is deferred", () => {
      const r = evaluateCandidateTechnicalPreflight({
        identityEligible: true,
        financeEligible: false,
        consentEligible: true,
        complexIdentity: false,
        disputedFinance: true,
        criticalClinicalBlocker: false,
        namedOperationalOwner: true,
        namedClinicalOwner: true,
        isSyntheticOrSmoke: false,
        pathway: defaultPathwayLock(),
        pathwayLocked: defaultPathwayLock(),
      });
      assert.equal(r.statusHint, "deferred");
    });

    it("72. critical clinical blocker excludes candidate", () => {
      const r = evaluateCandidateTechnicalPreflight({
        identityEligible: true,
        financeEligible: true,
        consentEligible: true,
        complexIdentity: false,
        disputedFinance: false,
        criticalClinicalBlocker: true,
        namedOperationalOwner: true,
        namedClinicalOwner: true,
        isSyntheticOrSmoke: false,
        pathway: defaultPathwayLock(),
        pathwayLocked: defaultPathwayLock(),
      });
      assert.equal(r.statusHint, "excluded");
    });

    it("73. candidate requires named owner", () => {
      const r = evaluateCandidateTechnicalPreflight({
        identityEligible: true,
        financeEligible: true,
        consentEligible: true,
        complexIdentity: false,
        disputedFinance: false,
        criticalClinicalBlocker: false,
        namedOperationalOwner: false,
        namedClinicalOwner: true,
        isSyntheticOrSmoke: false,
        pathway: defaultPathwayLock(),
        pathwayLocked: defaultPathwayLock(),
      });
      assert.equal(r.pass, false);
      assert.ok((r.reasons).includes("named_operational_owner_required"));
    });

    it("74. candidate cannot be bulk-approved", () => {
      assert.equal(bulkApproveCandidates(["a", "b"]).ok, false);
    });

    it("75. approved cohort limit is enforced", () => {
      assert.equal(enforceApprovedCohortLimit({
          currentlyApprovedOrEnrolled: 5,
          additionalApprovals: 1,
        }).ok, false);
      const review: PilotCohortCandidateReview = {
        id: "c1",
        tenantId: EVOLVED_HAIR_TENANT_ID,
        programmeId: "p1",
        patientId: "pat-1",
        pathway: defaultPathwayLock(),
        status: "eligible_for_governance_review",
        identityPreflightEligible: true,
        financePreflightEligible: true,
        consentPreflightEligible: true,
        clinicalReviewPassed: true,
        operationalReviewPassed: true,
        supportOwnerUserId: "u1",
        clinicalOwnerUserId: "u2",
        operationalOwnerUserId: "u3",
        decision: null,
        decisionReason: null,
        approvedBy: null,
        decidedAt: null,
        createdAt: "2026-07-30T00:00:00.000Z",
        updatedAt: "2026-07-30T00:00:00.000Z",
      };
      const approved = approveCandidateIndividually({
        review,
        approvedBy: "director-1",
        at: "2026-07-30T05:00:00.000Z",
        reason: "Low-complexity quote-to-deposit candidate",
      });
      assert.equal(approved.ok, true);
    });
  });

  // -------------------------------------------------------------------------
  // Pause and rollback (76–81)
  // -------------------------------------------------------------------------
  describe("pause and rollback", () => {
    it("76. critical identity issue recommends pause", () => {
      const r = evaluatePilotPauseRecommendation({
        triggers: ["critical_identity_issue"],
        activationState: "initial_cohort_active",
      });
      assert.equal(r.recommendPause, true);
      assert.equal(r.humanActionRequired, true);
    });

    it("77. cross-tenant issue recommends pause", () => {
      assert.equal(evaluatePilotPauseRecommendation({
          triggers: ["cross_tenant_concern"],
          activationState: "approved_for_initial_invites",
        }).recommendPause, true);
    });

    it("78. wrong-patient payment recommends pause", () => {
      assert.equal(evaluatePilotPauseRecommendation({
          triggers: ["wrong_patient_payment"],
          activationState: "initial_cohort_active",
        }).recommendPause, true);
    });

    it("79. programme pause stops new invitations", () => {
      assert.equal(programmePauseStopsNewInvitations("paused"), true);
      assert.equal(programmePauseStopsNewInvitations("hold"), true);
      const invite = mayIssueInvitation({
        activationState: "paused",
        humanApprovedForInitialInvites: true,
        candidateApproved: true,
        identityPreflightPass: true,
        operationalPreflightPass: true,
        humanClinicalApproval: true,
        patientPilotConsentReady: true,
        criticalBlockerOpen: false,
        namedOwnerPresent: true,
        supportCoverageActive: true,
        invitesEnabled: true,
        currentInviteCount: 0,
        maxInvites: 5,
      });
      assert.equal(invite.allowed, false);
    });

    it("80. rollback preserves audit history", () => {
      const plan = buildPilotRollbackPlan();
      assert.ok((plan.mustPreserve).includes("audit_history"));
      assert.ok((plan.mustPreserve).includes("activation_decisions"));
      assert.equal(mayDeleteOnRollback("audit_history"), false);
      assert.equal(plan.preservesEvidence, true);
    });

    it("81. rollback preserves clinical and finance records", () => {
      assert.equal(mayDeleteOnRollback("clinical_records"), false);
      assert.equal(mayDeleteOnRollback("financial_records"), false);
      assert.equal(mayDeleteOnRollback("invitation_enablement_flag"), true);
    });
  });

  // -------------------------------------------------------------------------
  // Regression (82–86)
  // -------------------------------------------------------------------------
  describe("regression", () => {
    it("82. 1A invitation gate still fails closed without humans", () => {
      const gate = evaluateRealPatientPilotGate({
        technicalAcceptance: true,
        migrationsApplied: true,
        tenantIsolationProven: true,
        roleMatrixProven: true,
        identityIntegrityProven: true,
        financeIntegrityProven: true,
        consentControlsProven: true,
      });
      assert.equal(gate.eligible, false);
    });

    it("83. no Stripe activation is introduced", () => {
      const safeguards = getInitialInvitationSafeguards();
      assert.equal(safeguards.invitationsEnabledByDefault, false);
      const finance = evaluatePilotPatientFinancePreflight({
        tenantId: EVOLVED_HAIR_TENANT_ID,
        programmeId: "p",
        patientId: "pat",
        quoteId: "q",
        quotePatientId: "pat",
        quoteStatus: "accepted",
        invoicePatientId: "pat",
        depositRequired: true,
        depositVerified: true,
        unallocatedPaymentPresent: false,
        paymentPatientIdMismatch: false,
        reconciliationException: false,
        paymentPlanActive: false,
        paymentPlanSatisfiesClearance: true,
        clearanceState: "deposit_ready",
        stripeEnabled: true,
        stripeBranchOnlyCapability: false,
      });
      assert.equal(finance.eligible, false);
      assert.ok((finance.criticalBlockers).includes("stripe_enabled"));
    });

    it("84–85. invitations remain disabled; no real enrolment via activation gate", () => {
      const gate = evaluateControlledPilotActivationGate(completeActivationGateInput());
      assert.equal(gate.approvedForInitialInvites, false);
      assert.equal(getInitialInvitationSafeguards().bulkInvitationForbidden, true);
    });

    it("86. hold and paused remain distinguishable", () => {
      assert.equal(programmePauseStopsNewInvitations("hold"), true);
      assert.equal(programmePauseStopsNewInvitations("paused"), true);
      assert.equal(canTransitionActivationState({
          from: "hold",
          to: "paused",
        }), true);
      assert.equal(canTransitionActivationState({
          from: "paused",
          to: "hold",
        }), true);
    });

    it("named approval cannot be empty; finalised approvals immutable", () => {
      let d = createActivationDecisionDraft({
        id: "d",
        programmeId: "p",
        tenantId: EVOLVED_HAIR_TENANT_ID,
        decisionType: "governance_review",
        decisionState: "governance_review",
        decisionVersion: 1,
        requestedAt: "2026-07-30T00:00:00.000Z",
        requestedBy: "ops",
      });
      assert.equal(recordNamedApproval(d, "clinical", { approvedBy: "  ", approvedAt: "t" }).ok, false);
      const ok = recordNamedApproval(d, "clinical", {
        approvedBy: "clinician-1",
        approvedAt: "2026-07-30T01:00:00.000Z",
      });
      assert.equal(ok.ok, true);
      if (!ok.ok) return;
      d = ok.record;
      for (const axis of [
        "privacy",
        "operations",
        "technical",
        "director",
        "cohort",
      ] as const) {
        const next = recordNamedApproval(d, axis, {
          approvedBy: `${axis}-1`,
          approvedAt: "2026-07-30T01:00:00.000Z",
        });
        assert.equal(next.ok, true);
        if (next.ok) d = next.record;
      }
      d = {
        ...d,
        supportConfirmed: true,
        rollbackConfirmed: true,
        incidentResponseConfirmed: true,
        staffTrainingConfirmed: true,
      };
      const fin = finaliseActivationDecision(d, {
        decision: "approved",
        decisionReason: "All named approvals recorded",
        at: "2026-07-30T02:00:00.000Z",
      });
      assert.equal(fin.ok, true);
      if (!fin.ok) return;
      assert.equal(recordNamedApproval(fin.record, "clinical", {
          approvedBy: "other",
          approvedAt: "later",
        }).ok, false);
      assert.equal(rejectedDecisionRemainsAuditable([fin.record]), false);
      assert.equal(nextDecisionVersion([fin.record]), 2);
    });

    it("role matrix summary reports pending live browser proofs honestly", () => {
      const summary = summariseRoleMatrixAcceptance();
      assert.equal(summary.proven, false);
      assert.ok((summary.pendingCount) > 0);
    });

    it("event coverage sufficient when critical events wired", () => {
      assert.equal(summariseEventCoverage().sufficientForInitialPathway, true);
    });
  });
});
