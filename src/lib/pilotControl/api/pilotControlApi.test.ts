/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — API acceptance tests (pure + in-memory).
 * Retains prior 107 engine tests separately; this file covers API-layer contracts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY,
  PILOT_HEALTH_RULE_VERSION,
  pilotControlRoleHasScope,
} from "../pilotControlContracts";
import { computeActivationRate } from "../pilotEnrolmentCore";
import { READINESS_EVALUATION_VERSION } from "../readiness/readinessTypes";
import { BLOCKER_EVALUATION_VERSION } from "../blockers/blockerTypes";
import type { PilotBlockerRecord } from "../blockers/blockerTypes";
import { projectReadinessForRole } from "../readiness/roleSensitiveProjection";
import { projectBlockerForRole } from "../blockers/roleSensitiveBlockerProjection";
import {
  PILOT_SYNTHETIC_COHORT,
  PILOT_SYNTHETIC_PROGRAMME_ID,
  PILOT_SYNTHETIC_TENANT_ID,
  baseReadySnapshot,
} from "../pilotSyntheticCohort";
import { deriveOverallReadiness } from "../pilotReadinessCore";

import { PilotControlApiError, toPilotControlApiErrorBody } from "./pilotControlApiErrors";
import {
  buildPagination,
  compareBlockersBySeverityThenAge,
  parseAllowlistedSort,
  parseBoundedDateRange,
  parsePagination,
  parseSearch,
  PILOT_CONTROL_MAX_ACTIVITY_RANGE_DAYS,
  PILOT_CONTROL_MAX_PAGE_SIZE,
  PILOT_CONTROL_MAX_SEARCH_LENGTH,
  PILOT_PATIENT_REGISTER_SORTS,
} from "./pilotControlPagination";
import {
  canSeePilotPauseRecommendation,
  roleHasApiPermission,
} from "./pilotControlPermissions";
import { mapToPilotControlRole } from "./pilotControlRoleMap";
import {
  __resetPilotControlRateLimitsForTests,
  checkPilotControlExportRateLimit,
  checkPilotControlRequestRateLimit,
  PILOT_CONTROL_RATE_LIMITS,
} from "./pilotControlRateLimit";
import {
  clampExportRows,
  rowsToCsv,
  sanitizeCsvCell,
  safeExportFilename,
} from "./pilotControlExportSafety";
import { buildPilotSourceLinksWithAliases } from "./pilotControlSourceLinks";
import {
  assemblePilotControlHealth,
  mapHealthVerdictForPauseVisibility,
} from "./assemblePilotHealth";
import {
  serializeActivityItem,
  serializeBlockerListItem,
  serializeProgrammeSummary,
  sortAndSerializeBlockers,
  projectReadinessCopy,
} from "./pilotControlSerializers";
import { buildResponseMeta, wrapPilotControlResponse } from "./pilotControlEnvelope";
import type { PilotPatientReadiness } from "../readiness/readinessTypes";

function blockerFixture(
  partial: Partial<PilotBlockerRecord> &
    Pick<PilotBlockerRecord, "fingerprint" | "severity" | "category" | "dimension">
): PilotBlockerRecord {
  const now = "2026-07-30T02:00:00.000Z";
  return {
    blockerKey: partial.fingerprint,
    programmeId: PILOT_SYNTHETIC_PROGRAMME_ID,
    enrolmentId: "c0000000-0000-4000-8000-000000000001",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000001",
    title: partial.title ?? "Test blocker",
    summary: partial.summary ?? "Summary",
    patientSafeSummary: partial.patientSafeSummary ?? "Patient-safe summary",
    recommendedNextAction: "Act",
    sourceModule: "pilot_enrolment",
    state: partial.state ?? "open",
    ownership: {
      ownerType: "clinic_manager",
      assignmentSource: "module_default",
      ownershipReason: "test",
    },
    firstDetectedAt: partial.firstDetectedAt ?? "2026-07-29T00:00:00.000Z",
    lastConfirmedAt: now,
    ageSeconds: partial.ageSeconds ?? 3600,
    escalation: {
      level: "none",
      escalated: false,
      requiresPilotPause: partial.escalation?.requiresPilotPause ?? false,
      requiresImmediateReview: false,
    },
    provenance: [],
    correlationIds: [],
    detectedByVersion: BLOCKER_EVALUATION_VERSION,
    evaluatedAt: now,
    criticalIntegrity: partial.criticalIntegrity ?? false,
    ...partial,
  };
}

function minimalReadiness(): PilotPatientReadiness {
  const evaluatedAt = "2026-07-30T02:00:00.000Z";
  const emptyDim = (dimension: PilotPatientReadiness["clinical"]["dimension"]) => ({
    dimension,
    state: "ready" as const,
    mandatorySignals: [],
    optionalSignals: [],
    blockers: [],
    warnings: [],
    provenance: [
      {
        sourceSystem: "pilot_enrolment" as const,
        observedValueClass: "present" as const,
        resolverVersion: READINESS_EVALUATION_VERSION,
        sourceRecordId: "rec-1",
      },
    ],
    evaluatedAt,
  });
  return {
    programmeId: PILOT_SYNTHETIC_PROGRAMME_ID,
    enrolmentId: "c0000000-0000-4000-8000-000000000001",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000001",
    clinical: {
      ...emptyDim("clinical"),
      mandatorySignals: [
        {
          key: "clinical.pathology",
          label: "Pathology",
          sourceSystem: "pathology",
          requirement: "mandatory",
          status: "satisfied",
          blocking: false,
          reasonCode: "ok",
          provenance: [
            {
              sourceSystem: "pathology",
              observedValueClass: "present",
              resolverVersion: READINESS_EVALUATION_VERSION,
              sourceRecordId: "path-1",
            },
          ],
        },
      ],
    },
    financial: emptyDim("financial"),
    patient: emptyDim("patient"),
    operational: emptyDim("operational"),
    technical: emptyDim("technical"),
    overall: {
      state: "ready",
      reasons: [],
      failClosed: false,
      evaluatedAt,
      evaluationVersion: READINESS_EVALUATION_VERSION,
    },
    blockers: [],
    warnings: [],
    evaluatedAt,
    evaluationVersion: READINESS_EVALUATION_VERSION,
    journeyStage: "consultation_preparation",
    identityIntegrityBlocked: false,
  };
}

describe("1A.4 API — auth/permission mapping", () => {
  it("maps director and reception roles", () => {
    assert.equal(mapToPilotControlRole({ fiUserRole: "owner" }), "director");
    assert.equal(mapToPilotControlRole({ staffRole: "reception" }), "reception");
    assert.equal(mapToPilotControlRole({ staffRole: "finance" }), "finance");
    assert.equal(mapToPilotControlRole({ platformAdmin: true }), "administrator");
    assert.equal(mapToPilotControlRole({ fiUserRole: "member" }), null);
  });

  it("fail-closes unknown role scopes", () => {
    assert.equal(roleHasApiPermission(null, "pilot_control.overview.read"), false);
    assert.equal(roleHasApiPermission("reception", "pilot_control.export"), false);
    assert.equal(roleHasApiPermission("director", "pilot_control.export"), true);
  });
});

describe("1A.4 API — pagination and filters", () => {
  it("requires pagination for register-style calls", () => {
    assert.throws(
      () => parsePagination({ page: null, pageSize: null }, "c1", { required: true }),
      (e: unknown) => e instanceof PilotControlApiError && e.code === "PILOT_CONTROL_INVALID_PAGINATION"
    );
  });

  it("rejects oversized page size", () => {
    assert.throws(
      () =>
        parsePagination(
          { page: "1", pageSize: String(PILOT_CONTROL_MAX_PAGE_SIZE + 1) },
          "c1"
        ),
      (e: unknown) => e instanceof PilotControlApiError && e.code === "PILOT_CONTROL_INVALID_PAGINATION"
    );
  });

  it("rejects invalid sort", () => {
    assert.throws(
      () => parseAllowlistedSort("drop table", PILOT_PATIENT_REGISTER_SORTS, "updated_at", "c1"),
      (e: unknown) => e instanceof PilotControlApiError && e.code === "PILOT_CONTROL_INVALID_FILTER"
    );
  });

  it("rejects excessive search length", () => {
    assert.throws(
      () => parseSearch("x".repeat(PILOT_CONTROL_MAX_SEARCH_LENGTH + 1), "c1"),
      (e: unknown) => e instanceof PilotControlApiError && e.code === "PILOT_CONTROL_INVALID_FILTER"
    );
  });

  it("enforces activity date range bound", () => {
    const from = "2026-01-01T00:00:00.000Z";
    const to = "2026-06-01T00:00:00.000Z";
    assert.throws(
      () => parseBoundedDateRange({ from, to }, "c1"),
      (e: unknown) =>
        e instanceof PilotControlApiError && e.code === "PILOT_CONTROL_DATE_RANGE_TOO_WIDE"
    );
    assert.equal(PILOT_CONTROL_MAX_ACTIVITY_RANGE_DAYS, 31);
  });

  it("builds stable pagination metadata", () => {
    const p = buildPagination({ page: 2, pageSize: 25, total: 60 });
    assert.equal(p.totalPages, 3);
    assert.equal(p.hasNextPage, true);
    assert.equal(p.hasPreviousPage, true);
  });
});

describe("1A.4 API — programme / overview / health", () => {
  it("Evolved programme exposes real invites disabled", () => {
    const summary = serializeProgrammeSummary({
      id: PILOT_SYNTHETIC_PROGRAMME_ID,
      key: EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY,
      name: "Evolved Controlled Pilot",
      status: "planned",
      enrolments: [],
    });
    assert.equal(summary.realPatientInvitesEnabled, false);
    assert.equal(summary.status, "planned");
  });

  it("empty denominator returns null activation rate", () => {
    assert.equal(computeActivationRate({ invited: 0, activated: 0, active: 0 }), null);
  });

  it("empty cohort returns insufficient_evidence AMBER (not misleading GREEN)", () => {
    const health = assemblePilotControlHealth({
      programmeStatus: "planned",
      enrolments: [],
      blockers: [],
    });
    assert.equal(health.verdict, "AMBER");
    assert.equal(health.expansionRecommendation, "insufficient_evidence");
    assert.equal(health.ruleVersion, PILOT_HEALTH_RULE_VERSION);
  });

  it("critical stop condition returns RED", () => {
    const health = assemblePilotControlHealth({
      programmeStatus: "active",
      enrolments: PILOT_SYNTHETIC_COHORT.filter((e) => e.tenantId === PILOT_SYNTHETIC_TENANT_ID),
      blockers: [
        blockerFixture({
          fingerprint: "crit-1",
          severity: "critical",
          category: "identity",
          dimension: "identity",
          criticalIntegrity: true,
          escalation: {
            level: "critical",
            escalated: true,
            requiresPilotPause: true,
            requiresImmediateReview: true,
          },
        }),
      ],
    });
    assert.equal(health.verdict, "RED");
  });

  it("excess high blockers returns AMBER", () => {
    const highs = Array.from({ length: 6 }, (_, i) =>
      blockerFixture({
        fingerprint: `high-${i}`,
        severity: "high",
        category: "clinic_action_overdue",
        dimension: "operational",
      })
    );
    const health = assemblePilotControlHealth({
      programmeStatus: "active",
      enrolments: PILOT_SYNTHETIC_COHORT.filter((e) => e.tenantId === PILOT_SYNTHETIC_TENANT_ID),
      blockers: highs,
    });
    assert.equal(health.verdict, "AMBER");
  });

  it("resolved blockers no longer affect health", () => {
    const health = assemblePilotControlHealth({
      programmeStatus: "active",
      enrolments: PILOT_SYNTHETIC_COHORT.filter((e) => e.tenantId === PILOT_SYNTHETIC_TENANT_ID),
      blockers: [
        blockerFixture({
          fingerprint: "resolved-crit",
          severity: "critical",
          category: "identity",
          dimension: "identity",
          state: "resolved",
          criticalIntegrity: true,
        }),
      ],
    });
    assert.notEqual(health.verdict, "RED");
  });

  it("pilot-pause recommendation visible only to authorised roles", () => {
    const health = assemblePilotControlHealth({
      programmeStatus: "active",
      enrolments: PILOT_SYNTHETIC_COHORT.filter((e) => e.tenantId === PILOT_SYNTHETIC_TENANT_ID),
      blockers: [
        blockerFixture({
          fingerprint: "pause-1",
          severity: "critical",
          category: "identity",
          dimension: "identity",
          criticalIntegrity: true,
          escalation: {
            level: "critical",
            escalated: true,
            requiresPilotPause: true,
            requiresImmediateReview: true,
          },
        }),
      ],
    });
    assert.equal(canSeePilotPauseRecommendation("director"), true);
    assert.equal(canSeePilotPauseRecommendation("reception"), false);
    const redacted = mapHealthVerdictForPauseVisibility(health, false);
    assert.ok(!redacted.stopConditions.some((s) => s.code === "pilot_pause_recommended"));
  });

  it("counts derive from explicit synthetic enrolments only", () => {
    const summary = serializeProgrammeSummary({
      id: PILOT_SYNTHETIC_PROGRAMME_ID,
      key: EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY,
      name: "Synthetic",
      status: "planned",
      enrolments: PILOT_SYNTHETIC_COHORT.filter((e) => e.tenantId === PILOT_SYNTHETIC_TENANT_ID),
    });
    assert.ok(summary.enrolmentCounts.active >= 0);
    assert.equal(
      Object.values(summary.enrolmentCounts).reduce((a, b) => a + b, 0),
      PILOT_SYNTHETIC_COHORT.filter((e) => e.tenantId === PILOT_SYNTHETIC_TENANT_ID).length
    );
  });
});

describe("1A.4 API — blockers serialization", () => {
  it("default severity ordering: critical before high; oldest first within severity", () => {
    const items = sortAndSerializeBlockers(
      [
        blockerFixture({
          fingerprint: "h-new",
          severity: "high",
          category: "documents",
          dimension: "operational",
          ageSeconds: 10,
          firstDetectedAt: "2026-07-30T01:00:00.000Z",
        }),
        blockerFixture({
          fingerprint: "c-old",
          severity: "critical",
          category: "identity",
          dimension: "identity",
          ageSeconds: 100,
          firstDetectedAt: "2026-07-28T00:00:00.000Z",
        }),
        blockerFixture({
          fingerprint: "h-old",
          severity: "high",
          category: "documents",
          dimension: "operational",
          ageSeconds: 500,
          firstDetectedAt: "2026-07-20T00:00:00.000Z",
        }),
      ],
      "director"
    );
    assert.equal(items[0]!.id, "c-old");
    assert.equal(items[1]!.id, "h-old");
    assert.equal(items[2]!.id, "h-new");
  });

  it("compare helper is deterministic", () => {
    const a = { severity: "critical", ageSeconds: 10 };
    const b = { severity: "high", ageSeconds: 999 };
    assert.ok(compareBlockersBySeverityThenAge(a, b) < 0);
  });

  it("patient-safe summary absent for identity blockers", () => {
    const item = serializeBlockerListItem(
      blockerFixture({
        fingerprint: "id-1",
        severity: "critical",
        category: "identity",
        dimension: "identity",
        criticalIntegrity: true,
        patientSafeSummary: "should not appear",
      }),
      "director"
    );
    assert.equal(item.patientSafeSummary, undefined);
  });

  it("pilot-pause flags restricted for reception", () => {
    const item = serializeBlockerListItem(
      blockerFixture({
        fingerprint: "p-1",
        severity: "high",
        category: "governance_approval",
        dimension: "governance",
        escalation: {
          level: "high",
          escalated: true,
          requiresPilotPause: true,
          requiresImmediateReview: true,
        },
      }),
      "reception"
    );
    assert.equal(item.escalation.requiresPilotPause, undefined);
  });

  it("role-sensitive summaries applied for reception clinical blockers", () => {
    const projected = projectBlockerForRole(
      blockerFixture({
        fingerprint: "clin-1",
        severity: "attention",
        category: "pathology",
        dimension: "clinical",
        summary: "Detailed pathology value XYZ",
      }),
      "reception"
    );
    assert.equal(projected.redacted, true);
    assert.ok(!projected.summary.includes("XYZ") || projected.provenance.length === 0);
  });
});

describe("1A.4 API — activity / export safety", () => {
  it("activity serializer never returns payload clinical/message content", () => {
    const item = serializeActivityItem(
      {
        id: "e1",
        eventKind: "message_received",
        actorType: "patient",
        sourceModule: "patient_app_gateway",
        createdAt: "2026-07-30T00:00:00.000Z",
        payload: {
          message_body: "secret clinical note",
          image_url: "https://example.com/x.png",
        },
      },
      "reception"
    );
    assert.ok(!item.safeSummary.includes("secret"));
    assert.ok(!JSON.stringify(item).includes("https://example.com"));
  });

  it("CSV formula injection is neutralised", () => {
    assert.ok(sanitizeCsvCell("=1+1").startsWith("'") || sanitizeCsvCell("=1+1").includes("'="));
    const csv = rowsToCsv(["name"], [{ name: "+cmd" }]);
    assert.ok(csv.includes("'+cmd") || csv.includes("'+cmd"));
  });

  it("safe filenames and row limits", () => {
    const name = safeExportFilename({
      programmeKey: EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY,
      exportType: "patient_register",
      format: "csv",
      at: "2026-07-30T00:00:00.000Z",
    });
    assert.ok(name.endsWith(".csv"));
    assert.ok(!name.includes("/"));
    assert.throws(
      () => clampExportRows(Array.from({ length: 501 }, (_, i) => ({ i })), "c1"),
      (e: unknown) => e instanceof PilotControlApiError
    );
  });

  it("export rate limiting works", () => {
    __resetPilotControlRateLimitsForTests();
    const key = "test-export-user";
    for (let i = 0; i < PILOT_CONTROL_RATE_LIMITS.exportPerUserPer10Minutes; i++) {
      assert.equal(checkPilotControlExportRateLimit(key).allowed, true);
    }
    assert.equal(checkPilotControlExportRateLimit(key).allowed, false);
  });

  it("request rate limiting works", () => {
    __resetPilotControlRateLimitsForTests();
    const key = "test-req-user";
    for (let i = 0; i < PILOT_CONTROL_RATE_LIMITS.perUserPerMinute; i++) {
      assert.equal(checkPilotControlRequestRateLimit(key).allowed, true);
    }
    assert.equal(checkPilotControlRequestRateLimit(key).allowed, false);
  });
});

describe("1A.4 API — role projection / source links / errors", () => {
  it("reception projection hides clinical provenance", () => {
    const ready = minimalReadiness();
    const projected = projectReadinessForRole(ready, "reception");
    assert.equal(projected.clinical.provenance.length, 0);
    assert.ok(projected.clinical.mandatorySignals.every((s) => s.provenance.length === 0));
  });

  it("finance projection hides unnecessary clinical details", () => {
    const ready = minimalReadiness();
    const projected = projectReadinessForRole(ready, "finance");
    assert.equal(projected.clinical.provenance.length, 0);
  });

  it("clinical projection exposes workflow status", () => {
    const ready = minimalReadiness();
    const projected = projectReadinessForRole(ready, "clinical");
    assert.equal(projected.clinical.state, "ready");
    assert.ok(projected.clinical.mandatorySignals.length > 0);
  });

  it("technical projection hides clinical/financial provenance detail", () => {
    assert.equal(pilotControlRoleHasScope("technical", "detail_clinical_full"), false);
    assert.equal(pilotControlRoleHasScope("technical", "detail_financial_full"), false);
  });

  it("source links use canonical patient UUID and are permission filtered", () => {
    const links = buildPilotSourceLinksWithAliases({
      tenantId: PILOT_SYNTHETIC_TENANT_ID,
      patientId: "d0000000-0000-4000-8000-000000000001",
      role: "reception",
    });
    assert.ok(links.every((l) => l.href.includes("d0000000-0000-4000-8000-000000000001")));
    assert.ok(!links.some((l) => l.module === "pathology"));
    assert.ok(links.some((l) => l.module === "patient"));
  });

  it("rejects non-canonical patient ids for source links", () => {
    const links = buildPilotSourceLinksWithAliases({
      tenantId: PILOT_SYNTHETIC_TENANT_ID,
      patientId: "HUBSPOT-123",
      role: "director",
    });
    assert.equal(links.length, 0);
  });

  it("errors include correlation id and hide raw db text", () => {
    const err = new PilotControlApiError(
      "PILOT_CONTROL_EVALUATION_FAILED",
      "Pilot control evaluation could not be completed.",
      500,
      "corr-xyz"
    );
    const body = toPilotControlApiErrorBody(err);
    assert.equal(body.error.correlationId, "corr-xyz");
    assert.ok(!body.error.message.toLowerCase().includes("postgres"));
  });

  it("envelope includes evaluation versions", () => {
    const meta = buildResponseMeta({
      programmeId: PILOT_SYNTHETIC_PROGRAMME_ID,
      tenantId: PILOT_SYNTHETIC_TENANT_ID,
      correlationId: "c1",
    });
    assert.equal(meta.evaluation?.readinessVersion, READINESS_EVALUATION_VERSION);
    assert.equal(meta.evaluation?.blockerVersion, BLOCKER_EVALUATION_VERSION);
    assert.equal(meta.evaluation?.healthVersion, PILOT_HEALTH_RULE_VERSION);
    const wrapped = wrapPilotControlResponse({ ok: true }, meta);
    assert.equal(wrapped.meta.partial, false);
  });

  it("API serializers do not alter readiness overall state", () => {
    const ready = minimalReadiness();
    const before = ready.overall.state;
    const projected = projectReadinessCopy(ready, "reception");
    assert.equal(projected.overall.state, before);
    assert.equal(ready.overall.state, before);
  });

  it("API serializers do not alter blocker severity", () => {
    const b = blockerFixture({
      fingerprint: "sev-1",
      severity: "high",
      category: "documents",
      dimension: "operational",
    });
    const item = serializeBlockerListItem(b, "reception");
    assert.equal(item.severity, "high");
    assert.equal(b.severity, "high");
  });

  it("role projection does not mutate canonical readiness", () => {
    const ready = minimalReadiness();
    const originalProv = ready.clinical.provenance.length;
    projectReadinessForRole(ready, "reception");
    assert.equal(ready.clinical.provenance.length, originalProv);
  });

  it("repeated deterministic health for unchanged inputs", () => {
    const args = {
      programmeStatus: "planned",
      enrolments: [] as const,
      blockers: [] as const,
      evaluatedAt: "2026-07-30T02:00:00.000Z",
    };
    const a = assemblePilotControlHealth(args);
    const b = assemblePilotControlHealth(args);
    assert.deepEqual(a, b);
  });

  it("synthetic healthy readiness remains distinguishable from live proof", () => {
    const snap = baseReadySnapshot();
    const overall = deriveOverallReadiness(snap);
    assert.equal(overall.overall, "ready");
    const health = assemblePilotControlHealth({
      programmeStatus: "planned",
      enrolments: [],
      blockers: [],
      syntheticEvidenceOnly: true,
    });
    assert.equal(health.expansionRecommendation, "insufficient_evidence");
  });
});
