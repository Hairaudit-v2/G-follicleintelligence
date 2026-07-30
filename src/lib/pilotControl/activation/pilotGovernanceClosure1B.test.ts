/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — Governance Closure proofs.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePilotControlRole,
  mapToPilotControlRole,
} from "../api/pilotControlRoleMap";
import {
  roleHasApiPermission,
  canExportPilotControl,
  canSeePilotActivationReadiness,
  permissionsForRole,
} from "../api/pilotControlPermissions";
import {
  parseExportType,
  parseExportFormat,
  sanitizeCsvCell,
  projectExportRowsForRole,
  buildExportAuditPayload,
  exportAuditContainsRowContent,
  PILOT_CONTROL_EXPORT_UI_CONTRACT,
  clampExportRows,
} from "../api/pilotControlExportSafety";
import { PilotControlApiError } from "../api/pilotControlApiErrors";
import { parseBoundedDateRange } from "../api/pilotControlPagination";
import { pilotControlRoleHasScope } from "../pilotControlContracts";
import { projectReadinessForRole } from "../readiness/roleSensitiveProjection";
import type { PilotPatientReadiness } from "../readiness/readinessTypes";
import { READINESS_EVALUATION_VERSION } from "../readiness/readinessTypes";
import {
  evaluateControlledPilotActivationGate,
  completeActivationGateInput,
} from "./controlledPilotActivationGate";
import { buildGovernanceClosureGateInput } from "./governanceClosureEvidence";
import {
  decideDomainEventEmission,
  mayEmitFinancialClearance,
  mayEmitPaymentVerified,
  mayEmitQuoteView,
  quoteDeliveredIdempotencyKey,
  scrubDomainEventPayload,
  classifySyntheticEvidence,
  buildPilotControlDomainEvent,
} from "./domainEvents";
import {
  evaluateSopApproval,
  evaluateStaffTraining,
  evaluateSupportCoverage,
  evaluatePatientPilotConsent,
  evaluateGovernanceTabletop,
  evaluateNamedActivationApprovals,
  assertHumanApprovalsNotAutoSet,
  REQUIRED_SOP_SECTIONS,
  type NamedApproval,
  type PilotSopApproval,
  type PilotSupportCoverage,
  type PatientPilotConsentApproval,
  type PilotGovernanceTabletopRecord,
} from "./governanceEvidence";
import { PILOT_1B_REQUIRED_EVENT_COVERAGE, summariseEventCoverage } from "./eventCoverage";

function emptyDim(state: "ready" = "ready") {
  return {
    state,
    mandatorySignals: [] as [],
    optionalSignals: [] as [],
    provenance: [
      {
        sourceSystem: "test" as const,
        observedValueClass: "ready" as const,
        resolverVersion: "t",
        sourceRecordId: "secret-id",
      },
    ],
    blockers: [] as [],
    warnings: [] as [],
    evaluatedAt: "2026-07-30T00:00:00.000Z",
  };
}

function minimalReadiness(): PilotPatientReadiness {
  return {
    enrolmentId: "e1",
    patientId: "p1",
    programmeId: "prog",
    tenantId: "t1",
    clinical: emptyDim(),
    financial: emptyDim(),
    operational: emptyDim(),
    patient: emptyDim(),
    technical: emptyDim(),
    overall: {
      state: "ready",
      reasons: [],
      failClosed: false,
      evaluatedAt: "2026-07-30T00:00:00.000Z",
      evaluationVersion: READINESS_EVALUATION_VERSION,
    },
    blockers: [],
    warnings: [],
    evaluatedAt: "2026-07-30T00:00:00.000Z",
    evaluationVersion: READINESS_EVALUATION_VERSION,
    journeyStage: "consultation_preparation",
    identityIntegrityBlocked: false,
  };
}

describe("1B Governance Closure — finance role mapping", () => {
  it("1. CFO maps to finance", () => {
    assert.equal(
      resolvePilotControlRole({
        staffRole: "CFO",
        fiUserRole: "tenant_backend",
      }),
      "finance"
    );
  });

  it("2. CFO does not map to administrator", () => {
    assert.notEqual(
      resolvePilotControlRole({ staffRole: "CFO", fiUserRole: "tenant_backend" }),
      "administrator"
    );
  });

  it("3. Explicit administrator remains administrator", () => {
    assert.equal(
      resolvePilotControlRole({
        explicitPilotRole: "administrator",
        staffRole: "CFO",
      }),
      "administrator"
    );
    assert.equal(mapToPilotControlRole({ platformAdmin: true }), "administrator");
  });

  it("4–5. Finance sees finance summaries and blockers scopes", () => {
    assert.equal(roleHasApiPermission("finance", "pilot_control.financial_summary.read"), true);
    assert.equal(roleHasApiPermission("finance", "pilot_control.finance_blockers.read"), true);
    assert.equal(roleHasApiPermission("finance", "pilot_control.overview.read"), true);
  });

  it("6. Finance can access permitted export types", () => {
    assert.equal(canExportPilotControl("finance"), true);
    assert.equal(roleHasApiPermission("finance", "pilot_control.export"), true);
    assert.equal(roleHasApiPermission("finance", "pilot_control.finance_export"), true);
  });

  it("7. Finance cannot access clinical detail", () => {
    assert.equal(pilotControlRoleHasScope("finance", "detail_clinical_full"), false);
    assert.equal(pilotControlRoleHasScope("finance", "detail_clinical_summary"), false);
    const projected = projectReadinessForRole(minimalReadiness(), "finance");
    assert.equal(projected.clinical.provenance.length, 0);
  });

  it("8. Finance cannot access pathology provenance (via clinical projection)", () => {
    assert.equal(pilotControlRoleHasScope("finance", "detail_clinical_full"), false);
    const projected = projectReadinessForRole(minimalReadiness(), "finance");
    assert.equal(projected.clinical.provenance.length, 0);
    // Export projection strips pathologyProvenance fields for finance.
    const exportProjected = projectExportRowsForRole(
      [{ pathologyProvenance: "lab", pathologyDetail: "x", quoteStatus: "ok" }],
      "finance"
    );
    assert.ok(!("pathologyProvenance" in exportProjected.rows[0]!));
    assert.ok(!("pathologyDetail" in exportProjected.rows[0]!));
  });

  it("9. Finance cannot approve pilot activation", () => {
    assert.equal(canSeePilotActivationReadiness("finance"), false);
    assert.equal(pilotControlRoleHasScope("finance", "activation_readiness_read"), false);
  });

  it("10. Finance cannot administer users (no admin scopes)", () => {
    const scopes = permissionsForRole("finance");
    assert.ok(!scopes.includes("activation_readiness_read"));
    assert.ok(!scopes.includes("overview_full"));
  });

  it("11–12. Wrong-tenant / inactive patterns fail closed at resolver when no role", () => {
    assert.equal(resolvePilotControlRole({ fiUserRole: "member" }), null);
    assert.equal(resolvePilotControlRole({}), null);
  });

  it("13. Role resolver fails closed on ambiguous permission assignments", () => {
    assert.equal(
      resolvePilotControlRole({
        permissionAssignments: ["pilot_control.finance.read", "pilot_control.admin"],
      }),
      null
    );
  });

  it("14. Role projection does not mutate readiness overall state", () => {
    const ready = minimalReadiness();
    const projected = projectReadinessForRole(ready, "finance");
    assert.equal(projected.overall.state, ready.overall.state);
    assert.equal(projected.financial.state, ready.financial.state);
  });

  it("Job title alone does not elevate to administrator", () => {
    assert.equal(resolvePilotControlRole({ jobTitle: "CEO" }), null);
    assert.equal(resolvePilotControlRole({ jobTitle: "Director" }), null);
  });

  it("Finance manager / bookkeeper map to finance", () => {
    assert.equal(resolvePilotControlRole({ jobTitle: "Finance manager" }), "finance");
    assert.equal(resolvePilotControlRole({ staffRole: "Bookkeeper" }), "finance");
  });
});

describe("1B Governance Closure — export validation", () => {
  it("9–10. Approved export types and formats parse", () => {
    for (const t of PILOT_CONTROL_EXPORT_UI_CONTRACT.allowedTypes) {
      assert.equal(parseExportType(t, "c1"), t);
    }
    assert.equal(parseExportFormat("csv", "c1"), "csv");
    assert.equal(parseExportFormat("json", "c1"), "json");
  });

  it("11. Invalid export type fails safely", () => {
    assert.throws(
      () => parseExportType("overview", "c1"),
      (e: unknown) =>
        e instanceof PilotControlApiError &&
        e.code === "PILOT_CONTROL_INVALID_EXPORT_TYPE"
    );
  });

  it("12. Invalid format fails safely", () => {
    assert.throws(
      () => parseExportFormat("xlsx", "c1"),
      (e: unknown) =>
        e instanceof PilotControlApiError && e.code === "PILOT_CONTROL_INVALID_EXPORT_FORMAT"
    );
  });

  it("13–14. Date validation and 31-day cap", () => {
    assert.throws(
      () =>
        parseBoundedDateRange(
          { from: "2026-01-01T00:00:00.000Z", to: "2026-03-01T00:00:00.000Z" },
          "c1"
        ),
      (e: unknown) =>
        e instanceof PilotControlApiError && e.code === "PILOT_CONTROL_DATE_RANGE_TOO_WIDE"
    );
    const ok = parseBoundedDateRange(
      { from: "2026-01-01T00:00:00.000Z", to: "2026-01-15T00:00:00.000Z" },
      "c1"
    );
    assert.ok(ok.from);
  });

  it("15. Role projection applies before export", () => {
    const rows = [
      {
        patientId: "p1",
        clinicalDetail: "secret",
        pathologyProvenance: "lab",
        quoteStatus: "accepted",
        financialDetail: "ok",
      },
    ];
    const finance = projectExportRowsForRole(rows, "finance");
    assert.ok(!("clinicalDetail" in finance.rows[0]!));
    assert.ok(!("pathologyProvenance" in finance.rows[0]!));
    assert.equal(finance.rows[0]!.quoteStatus, "accepted");

    const reception = projectExportRowsForRole(
      [{ clinicalProvenance: "x", patientId: "p1" }],
      "reception"
    );
    assert.ok(!("clinicalProvenance" in reception.rows[0]!));

    const technical = projectExportRowsForRole(
      [{ financialDetail: "x", patientId: "p1" }],
      "technical"
    );
    assert.ok(!("financialDetail" in technical.rows[0]!));
  });

  it("16. CSV injection remains neutralised", () => {
    assert.ok(sanitizeCsvCell("=SUM(A1)").startsWith("'"));
    assert.ok(sanitizeCsvCell("+cmd").includes("'"));
    assert.ok(sanitizeCsvCell("@cmd").includes("'"));
    assert.ok(sanitizeCsvCell("-1+1").includes("'") || sanitizeCsvCell("-1+1").startsWith("'"));
  });

  it("18–19. Export row limit enforced", () => {
    assert.throws(
      () => clampExportRows(Array.from({ length: 501 }, (_, i) => ({ i })), "c1"),
      (e: unknown) => e instanceof PilotControlApiError
    );
  });

  it("20–21. Export audit payload has no row content", () => {
    const payload = buildExportAuditPayload({
      exportType: "patient_register",
      format: "csv",
      rowCount: 3,
      role: "finance",
    });
    assert.equal(exportAuditContainsRowContent(payload), false);
    assert.equal(payload.rowCount, 3);
  });

  it("22. UI export request matches API contract", () => {
    assert.equal(PILOT_CONTROL_EXPORT_UI_CONTRACT.typeParam, "type");
    assert.ok(PILOT_CONTROL_EXPORT_UI_CONTRACT.allowedTypes.includes("programme_summary"));
    assert.ok(!PILOT_CONTROL_EXPORT_UI_CONTRACT.allowedTypes.includes("overview" as never));
  });
});

describe("1B Governance Closure — pathway events", () => {
  it("20–21. Quote delivery idempotent", () => {
    const key = quoteDeliveredIdempotencyKey("q1", "v1");
    const first = decideDomainEventEmission({
      existingKeys: [],
      nextKey: key,
      eventTenantId: "t1",
      expectedTenantId: "t1",
      eventType: "quote_delivered",
    });
    assert.equal(first.emit, true);
    const replay = decideDomainEventEmission({
      existingKeys: [key],
      nextKey: key,
      eventTenantId: "t1",
      expectedTenantId: "t1",
      eventType: "quote_delivered",
    });
    assert.equal(replay.emit, false);
    assert.equal(replay.duplicate, true);
  });

  it("3. Quote view follows first-view rule", () => {
    assert.equal(
      mayEmitQuoteView({ previousFirstViewedAt: null, nextFirstViewedAt: "2026-07-30" }).emit,
      true
    );
    assert.equal(
      mayEmitQuoteView({
        previousFirstViewedAt: "2026-07-29",
        nextFirstViewedAt: "2026-07-30",
      }).emit,
      false
    );
  });

  it("6–9. Payment verified / clearance rules", () => {
    assert.equal(
      mayEmitPaymentVerified({ allocationId: null, allocationMatched: false }).emit,
      false
    );
    assert.equal(
      mayEmitPaymentVerified({ allocationId: "a1", allocationMatched: true }).emit,
      true
    );
    assert.equal(
      mayEmitFinancialClearance({
        clearanceState: "financially_cleared",
        paymentAllocated: false,
        clearanceId: "c1",
      }).emit,
      false
    );
    assert.equal(
      mayEmitFinancialClearance({
        clearanceState: "financially_cleared",
        paymentAllocated: true,
        clearanceId: "c1",
      }).emit,
      true
    );
  });

  it("14–16. Synthetic / wrong-tenant / sensitive fields", () => {
    assert.equal(classifySyntheticEvidence("synthetic_fixture"), true);
    assert.equal(
      decideDomainEventEmission({
        existingKeys: [],
        nextKey: "k",
        eventTenantId: "other",
        expectedTenantId: "t1",
        eventType: "quote_delivered",
      }).reason,
      "wrong_tenant"
    );
    const scrubbed = scrubDomainEventPayload({
      quoteNarrative: "secret",
      amount: 100,
      ok: true,
    });
    assert.ok(scrubbed.stripped.includes("quoteNarrative"));
    assert.ok(!("amount" in scrubbed.safe));
  });

  it("18–20. Polling suppressed; invites gated; no auto enrol", () => {
    assert.equal(
      decideDomainEventEmission({
        existingKeys: [],
        nextKey: "k",
        eventTenantId: "t1",
        expectedTenantId: "t1",
        eventType: "quote_viewed",
        automaticPolling: true,
      }).emit,
      false
    );
    assert.equal(
      decideDomainEventEmission({
        existingKeys: [],
        nextKey: "k",
        eventTenantId: "t1",
        expectedTenantId: "t1",
        eventType: "pilot_patient_invited",
        humanInviteGateComplete: false,
      }).reason,
      "human_invite_gate_incomplete"
    );
    assert.equal(
      decideDomainEventEmission({
        existingKeys: [],
        nextKey: "k2",
        eventTenantId: "t1",
        expectedTenantId: "t1",
        eventType: "pilot_patient_enrolled",
        humanInviteGateComplete: false,
      }).emit,
      false
    );
  });

  it("Wired pathway events have production status", () => {
    for (const key of [
      "quote_delivered",
      "quote_viewed",
      "quote_accepted",
      "deposit_requested",
      "payment_verified",
      "financial_clearance_achieved",
      "notification_sent",
      "notification_failed",
      "blocker_opened",
    ]) {
      const entry = PILOT_1B_REQUIRED_EVENT_COVERAGE.find((e) => e.eventKey === key);
      assert.ok(entry, key);
      assert.ok(
        entry!.implementationStatus === "wired" ||
          entry!.implementationStatus === "wired_with_limitation",
        key
      );
    }
    assert.equal(summariseEventCoverage().sufficientForInitialPathway, true);
  });

  it("Domain event builder includes required envelope fields", () => {
    const evt = buildPilotControlDomainEvent({
      eventType: "quote_delivered",
      tenantId: "t1",
      programmeId: "p1",
      actorType: "staff",
      sourceModule: "crm_quotes",
      idempotencyKey: "quote_delivered:q1:v1",
      evidenceClass: "synthetic_fixture",
    });
    assert.equal(evt.eventType, "quote_delivered");
    assert.equal(evt.evidenceClass, "synthetic_fixture");
  });
});

describe("1B Governance Closure — human gates", () => {
  it("28. SOP template alone does not satisfy approval", () => {
    const r = evaluateSopApproval({
      approval: null,
      currentSopVersion: "1B.0-draft",
      currentSopChecksum: "abc",
    });
    assert.equal(r.operationalSopApproved, false);
  });

  it("29. Named SOP approval satisfies only when complete", () => {
    const approval: PilotSopApproval = {
      programmeId: "prog",
      sopVersion: "1B.0-draft",
      sopChecksum: "abc",
      approverName: "Ops Lead",
      approverRole: "operations",
      decision: "approved",
      approvedSections: [...REQUIRED_SOP_SECTIONS],
      conditions: [],
      decisionReason: "Reviewed",
      decidedAt: "2026-07-30T00:00:00.000Z",
    };
    assert.equal(
      evaluateSopApproval({
        approval,
        currentSopVersion: "1B.0-draft",
        currentSopChecksum: "abc",
      }).operationalSopApproved,
      true
    );
    assert.equal(
      evaluateSopApproval({
        approval: { ...approval, decision: "approved_with_conditions", conditions: ["x"] },
        currentSopVersion: "1B.0-draft",
        currentSopChecksum: "abc",
      }).operationalSopApproved,
      false
    );
  });

  it("30–31. Incomplete / missing role training blocks", () => {
    assert.equal(
      evaluateStaffTraining({ records: [] }).staffTrainingCompleted,
      false
    );
    assert.equal(
      evaluateStaffTraining({
        records: [
          {
            programmeId: "p",
            staffName: "A",
            staffRole: "director",
            trainerName: "T",
            sopVersion: "1",
            trainingVersion: "1",
            trainedAt: "2026-07-30",
            completionStatus: "completed",
            acknowledgement: "acknowledged",
            remainingSupportNeeds: [],
          },
        ],
      }).staffTrainingCompleted,
      false
    );
  });

  it("32–33. Support coverage requires confirmation and backup", () => {
    const draft: PilotSupportCoverage = {
      programmeId: "p",
      version: "1",
      operationalOwner: { name: "One", role: "ops" },
      technicalOwner: { name: "One", role: "tech" },
      financeEscalation: { name: "One", role: "fin" },
      clinicalEscalation: { name: "One", role: "clin" },
      privacyIncidentContact: { name: "One", role: "priv" },
      backupContacts: [],
      timezone: "Australia/Brisbane",
      coverageHours: [],
      responseTargets: [],
      weekendPosition: "on-call",
      leaveCoverage: "",
      confirmedBy: "",
      confirmedAt: "",
      status: "draft",
    };
    const r = evaluateSupportCoverage({ coverage: draft });
    assert.equal(r.supportCoverageConfirmed, false);
    assert.ok(r.blockers.some((b) => b.includes("backup")));
  });

  it("34–35. Consent requires four approvals; version change invalidates", () => {
    const named = (area: string): NamedApproval => ({
      area,
      approverName: "Person",
      approverRole: area,
      decision: "approved",
      decisionReason: "ok",
      conditions: [],
      evidenceReferences: [],
      decidedAt: "2026-07-30T00:00:00.000Z",
    });
    const approval: PatientPilotConsentApproval = {
      documentVersion: "1B.0-draft",
      documentChecksum: "c1",
      clinical: named("clinical"),
      privacy: named("privacy"),
      operations: named("operations"),
      director: named("director"),
      fullyApproved: true,
      conditions: [],
      approvedAt: "2026-07-30T00:00:00.000Z",
    };
    assert.equal(
      evaluatePatientPilotConsent({
        approval,
        currentDocumentVersion: "1B.0-draft",
        currentDocumentChecksum: "c1",
      }).patientPilotConsentApproved,
      true
    );
    assert.equal(
      evaluatePatientPilotConsent({
        approval,
        currentDocumentVersion: "1B.0-draft",
        currentDocumentChecksum: "changed",
      }).patientPilotConsentApproved,
      false
    );
  });

  it("36. Tabletop passed_with_actions incomplete until actions close", () => {
    const record: PilotGovernanceTabletopRecord = {
      exerciseId: "ex1",
      programmeId: "p",
      scenarioVersion: "1",
      conductedAt: "2026-07-30",
      facilitator: "F",
      participants: [
        { name: "A", role: "operations" },
        { name: "B", role: "finance" },
        { name: "C", role: "technical" },
        { name: "D", role: "director" },
      ],
      detectedAtStep: 1,
      pauseRecommended: true,
      fallbackActivated: true,
      evidencePreserved: true,
      correctionVerified: true,
      restartAuthorityIdentified: true,
      findings: [],
      sopChanges: [],
      unresolvedActions: ["update SOP"],
      result: "passed_with_actions",
    };
    const r = evaluateGovernanceTabletop({ record });
    assert.equal(r.incidentResponseConfirmed, false);
    assert.ok(r.blockers.includes("tabletop_actions_open"));
  });

  it("37. No candidate means initial cohort approval remains false", () => {
    const r = evaluateNamedActivationApprovals({
      approvals: [
        {
          area: "initial_cohort",
          approverName: "Dir",
          approverRole: "director",
          decision: "approved",
          decisionReason: "ok",
          conditions: [],
          evidenceReferences: [],
          decidedAt: "2026-07-30T00:00:00.000Z",
        },
      ],
      candidateCount: 0,
    });
    assert.equal(r.initialCohortApproved, false);
  });

  it("38. Director approval alone cannot satisfy all gates", () => {
    const r = evaluateNamedActivationApprovals({
      approvals: [
        {
          area: "director",
          approverName: "Dir",
          approverRole: "director",
          decision: "approved",
          decisionReason: "ok",
          conditions: [],
          evidenceReferences: [],
          decidedAt: "2026-07-30T00:00:00.000Z",
        },
      ],
      candidateCount: 0,
    });
    assert.ok(r.blockers.includes("director_cannot_satisfy_all_gates"));
  });

  it("39. Eligible governance review does not approve invitations", () => {
    const gate = evaluateControlledPilotActivationGate(buildGovernanceClosureGateInput());
    assert.equal(gate.eligibleForGovernanceReview, true);
    assert.equal(gate.approvedForInitialInvites, false);
    assert.equal(gate.operationalSopApproved, false);
    assert.equal(gate.financeRoleMappingCorrect, true);
    assert.equal(gate.exportSurfaceProven, true);
  });

  it("40. Human approval fields cannot be auto-set", () => {
    const check = assertHumanApprovalsNotAutoSet({
      proposed: { privacyApproved: true },
      namedApprovals: [],
    });
    assert.equal(check.valid, false);
  });

  it("Complete technical gate still defers invites", () => {
    const gate = evaluateControlledPilotActivationGate(
      completeActivationGateInput({ humanApprovedForInitialInvites: false })
    );
    assert.equal(gate.approvedForInitialInvites, false);
  });
});
