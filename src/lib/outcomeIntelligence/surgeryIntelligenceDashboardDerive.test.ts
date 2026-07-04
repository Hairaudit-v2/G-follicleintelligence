import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import type { FiAnalyticsEventRow } from "@/src/lib/analytics-os/analyticsEventCore";
import {
  buildSurgeryIntelligenceDashboardMetrics,
  composeSurgeryIntelligenceDashboardFromEvents,
  dedupeLatestPublishedCaseRows,
  filterPublishedCaseRows,
  parsePublishedSurgeryCaseIntelligenceEvent,
} from "./surgeryIntelligenceDashboardDerive";
import { SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE } from "./surgeryCaseFactsPublisherCore";
import { SURGERY_CASE_INTELLIGENCE_FACTS_VERSION } from "./surgeryCaseFactsCore";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const CASE = "33333333-3333-4333-8333-333333333333";
const SURGERY = "44444444-4444-4444-8444-444444444444";
const PATIENT = "55555555-5555-4555-8555-555555555555";

function factsPayload(overrides: Record<string, unknown> = {}) {
  return {
    facts_version: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
    tenant_id: TENANT_A,
    patient_id: PATIENT,
    case_id: CASE,
    surgery_id: SURGERY,
    booking_id: null,
    procedure_date: "2026-07-04",
    final_reviewed_graft_count: 120,
    graft_tray_ai_estimate: 120,
    graft_tray_manual_count: 118,
    graft_count_source: "ai",
    mismatch_band: "within_tolerance",
    confidence_band: "high",
    image_quality: "suitable",
    reviewer_id: "staff-1",
    reviewer_label: "Reviewer One",
    reviewed_at: "2026-07-04T12:00:00.000Z",
    has_final_graft_count: true,
    graft_tray_review_pending: false,
    superseded_stale_estimate: false,
    graft_session_id: null,
    target_grafts: 3000,
    extracted_grafts: 1200,
    implanted_grafts: 0,
    discarded_grafts: 0,
    remaining_grafts: 1200,
    reconciliation_status: "pending",
    graft_session_phase: "extraction",
    reconciled_at: null,
    confirmed_tray_grafts: 120,
    surgery_status: "completed",
    procedure_phase: "complete",
    live_status: "idle",
    surgeon_fi_user_id: "surgeon-1",
    team_fi_user_ids: ["team-1", "team-2"],
    graft_tray_image_ids: [],
    graft_tray_link_ids: [],
    graft_tray_links: [],
    graft_tray_outcome_facts: [],
    confidence_level: "high",
    imaging_intelligence_summary: null,
    longitudinal_outcome_summary: null,
    before_after_ready: false,
    donor_recovery_ready: false,
    recipient_growth_ready: false,
    follow_up_window_status: [],
    missing_outcome_evidence: [],
    ...overrides,
  };
}

function completeImagingSummaryFacts(overrides: Record<string, unknown> = {}) {
  return {
    groups: [
      {
        group: "baseline_pre_op",
        image_count: 3,
        usable_image_count: 3,
        poor_quality_count: 0,
        image_ids: ["11111111-1111-4111-8111-111111111111"],
        present_views: ["crown", "front", "top"],
        missing_required_views: [],
        complete: true,
      },
      {
        group: "donor",
        image_count: 1,
        usable_image_count: 1,
        poor_quality_count: 0,
        image_ids: ["22222222-2222-4222-8222-222222222222"],
        present_views: ["donor"],
        missing_required_views: [],
        complete: true,
      },
      {
        group: "recipient",
        image_count: 3,
        usable_image_count: 3,
        poor_quality_count: 0,
        image_ids: ["33333333-3333-4333-8333-333333333333"],
        present_views: ["front", "recipient", "top"],
        missing_required_views: [],
        complete: true,
      },
      {
        group: "graft_tray",
        image_count: 1,
        usable_image_count: 1,
        poor_quality_count: 0,
        image_ids: ["44444444-4444-4444-8444-444444444444"],
        present_views: ["graft_tray"],
        missing_required_views: [],
        complete: true,
      },
      {
        group: "immediate_post_op",
        image_count: 2,
        usable_image_count: 2,
        poor_quality_count: 0,
        image_ids: ["55555555-5555-4555-8555-555555555555"],
        present_views: ["front", "top"],
        missing_required_views: [],
        complete: true,
      },
      {
        group: "follow_up",
        image_count: 3,
        usable_image_count: 3,
        poor_quality_count: 0,
        image_ids: ["66666666-6666-4666-8666-666666666666"],
        present_views: ["crown", "front", "top"],
        missing_required_views: [],
        complete: true,
      },
    ],
    missing_required_views: [],
    poor_quality_image_ids: [],
    audit_readiness: {
      baseline_present: true,
      donor_set_complete: true,
      recipient_set_complete: true,
      immediate_post_op_present: true,
      follow_up_captured_or_due: true,
      reviewed_graft_count_present: true,
      hairaudit_link_resolved: true,
      hairaudit_linkage_conflict: false,
      before_after_ready: true,
      overall_audit_ready: true,
      missing_requirements: [],
    },
    completeness_score: 100,
    hairaudit_case_id: "66666666-6666-4666-8666-666666666666",
    hairaudit_link_origin: "legacy",
    ...overrides,
  };
}

function analyticsEvent(input: {
  tenantId?: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  clinicId?: string | null;
  id?: string;
}): FiAnalyticsEventRow {
  return {
    id: input.id ?? randomUUID(),
    tenant_id: input.tenantId ?? TENANT_A,
    clinic_id: input.clinicId ?? null,
    module_name: "surgery_os",
    event_type: SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE,
    entity_id: CASE,
    entity_type: "case",
    event_value: 120,
    event_metadata: {
      source: "surgery_case_intelligence",
      facts_version: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
      last_published_at: input.occurredAt,
      case_id: CASE,
      surgery_id: SURGERY,
      patient_id: PATIENT,
      has_final_graft_count: input.payload.has_final_graft_count,
      final_reviewed_graft_count: input.payload.final_reviewed_graft_count,
      payload_json: input.payload,
    },
    occurred_at: input.occurredAt,
    created_at: input.occurredAt,
  };
}

describe("surgeryIntelligenceDashboardDerive", () => {
  it("aggregates published reviewed facts correctly", () => {
    const events = [
      analyticsEvent({
        occurredAt: "2026-07-04T10:00:00.000Z",
        payload: factsPayload({ final_reviewed_graft_count: 120, graft_count_source: "ai" }),
      }),
      analyticsEvent({
        occurredAt: "2026-07-05T10:00:00.000Z",
        payload: factsPayload({
          case_id: "66666666-6666-4666-8666-666666666666",
          surgery_id: "77777777-7777-4777-8777-777777777777",
          final_reviewed_graft_count: 80,
          graft_count_source: "manual",
          graft_tray_ai_estimate: 85,
          graft_tray_manual_count: 80,
        }),
      }),
    ];

    const composed = composeSurgeryIntelligenceDashboardFromEvents({
      tenantId: TENANT_A,
      events,
      filters: {},
    });

    assert.equal(composed.metrics.totalReviewedCasesWithFinalCount, 2);
    assert.equal(composed.metrics.totalFinalReviewedGraftCount, 200);
    assert.equal(composed.metrics.averageFinalGraftCountPerCase, 100);
    assert.equal(composed.metrics.sourceSplit.ai, 1);
    assert.equal(composed.metrics.sourceSplit.manual, 1);
  });

  it("pending/no-final-count events do not inflate final graft totals", () => {
    const events = [
      analyticsEvent({
        occurredAt: "2026-07-04T10:00:00.000Z",
        payload: factsPayload({
          has_final_graft_count: false,
          final_reviewed_graft_count: null,
          graft_count_source: null,
          graft_tray_review_pending: true,
        }),
      }),
      analyticsEvent({
        occurredAt: "2026-07-05T10:00:00.000Z",
        payload: factsPayload({ final_reviewed_graft_count: 50 }),
      }),
    ];

    const metrics = buildSurgeryIntelligenceDashboardMetrics(
      events
        .map((e) => parsePublishedSurgeryCaseIntelligenceEvent(e, TENANT_A))
        .filter((r): r is NonNullable<typeof r> => r != null)
    );

    assert.equal(metrics.totalPublishedCases, 2);
    assert.equal(metrics.totalReviewedCasesWithFinalCount, 1);
    assert.equal(metrics.totalFinalReviewedGraftCount, 50);
    assert.equal(metrics.casesMissingFinalCount, 1);
    assert.equal(metrics.casesNeedingReview, 1);
  });

  it("source split counts only cases with final graft count", () => {
    const rows = [
      parsePublishedSurgeryCaseIntelligenceEvent(
        analyticsEvent({
          occurredAt: "2026-07-04T10:00:00.000Z",
          payload: factsPayload({ graft_count_source: "override" }),
        }),
        TENANT_A
      ),
      parsePublishedSurgeryCaseIntelligenceEvent(
        analyticsEvent({
          occurredAt: "2026-07-05T10:00:00.000Z",
          payload: factsPayload({
            has_final_graft_count: false,
            final_reviewed_graft_count: null,
            graft_count_source: "ai",
          }),
        }),
        TENANT_A
      ),
    ].filter((r): r is NonNullable<typeof r> => r != null);

    const metrics = buildSurgeryIntelligenceDashboardMetrics(rows);
    assert.equal(metrics.sourceSplit.override, 1);
    assert.equal(metrics.sourceSplit.ai, 0);
  });

  it("date and surgeon filtering works after dedupe", () => {
    const older = analyticsEvent({
      id: "older",
      occurredAt: "2026-06-01T10:00:00.000Z",
      payload: factsPayload({ surgeon_fi_user_id: "surgeon-a", procedure_date: "2026-06-01" }),
    });
    const newer = analyticsEvent({
      id: "newer",
      occurredAt: "2026-07-04T10:00:00.000Z",
      payload: factsPayload({ surgeon_fi_user_id: "surgeon-b", procedure_date: "2026-07-04" }),
    });

    const deduped = dedupeLatestPublishedCaseRows(
      [older, newer]
        .map((e) => parsePublishedSurgeryCaseIntelligenceEvent(e, TENANT_A))
        .filter((r): r is NonNullable<typeof r> => r != null)
    );
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]?.eventId, "newer");

    const surgeonFiltered = filterPublishedCaseRows(deduped, { surgeonFiUserId: "surgeon-b" });
    assert.equal(surgeonFiltered.length, 1);

    const procedureFiltered = filterPublishedCaseRows(deduped, {
      procedureDateAfter: "2026-07-01",
      procedureDateBefore: "2026-07-31",
    });
    assert.equal(procedureFiltered.length, 1);
  });

  it("tenant scoping rejects cross-tenant events", () => {
    const foreign = analyticsEvent({
      tenantId: TENANT_B,
      occurredAt: "2026-07-04T10:00:00.000Z",
      payload: factsPayload({ tenant_id: TENANT_B }),
    });
    assert.equal(parsePublishedSurgeryCaseIntelligenceEvent(foreign, TENANT_A), null);
  });

  it("dashboard table rows resolve legacy and structured HairAudit links", () => {
    const composed = composeSurgeryIntelligenceDashboardFromEvents({
      tenantId: TENANT_A,
      filters: {},
      events: [
        analyticsEvent({
          occurredAt: "2026-07-04T10:00:00.000Z",
          payload: factsPayload(),
        }),
      ],
      caseMetadataByCaseId: {
        [CASE]: {
          hairaudit_case_id: "66666666-6666-4666-8666-666666666666",
          report_id: "77777777-7777-4777-8777-777777777777",
        },
      },
    });
    assert.equal(composed.tableRows.length, 1);
    assert.equal(composed.tableRows[0]?.hairAuditLinkLabel, "Audit ready");
    assert.equal(composed.tableRows[0]?.hairAuditAdminHref, "/hair-audit/admin");
    assert.equal(
      composed.tableRows[0]?.hairAuditReportHref,
      `/fi-admin/${TENANT_A}/audit/77777777-7777-4777-8777-777777777777`
    );
    assert.equal(composed.tableRows[0]?.hairAuditLinkageConflict, false);
  });

  it("surfaces imaging completeness and audit readiness on dashboard rows and metrics", () => {
    const composed = composeSurgeryIntelligenceDashboardFromEvents({
      tenantId: TENANT_A,
      filters: {},
      events: [
        analyticsEvent({
          occurredAt: "2026-07-04T10:00:00.000Z",
          payload: factsPayload({
            imaging_intelligence_summary: completeImagingSummaryFacts(),
          }),
        }),
        analyticsEvent({
          occurredAt: "2026-07-05T10:00:00.000Z",
          payload: factsPayload({
            case_id: "88888888-8888-4888-8888-888888888888",
            surgery_id: "99999999-9999-4999-8999-999999999999",
            imaging_intelligence_summary: completeImagingSummaryFacts({
              completeness_score: 50,
              audit_readiness: {
                baseline_present: true,
                donor_set_complete: false,
                recipient_set_complete: false,
                immediate_post_op_present: false,
                follow_up_captured_or_due: false,
                reviewed_graft_count_present: false,
                hairaudit_link_resolved: false,
                hairaudit_linkage_conflict: false,
                before_after_ready: false,
                overall_audit_ready: false,
                missing_requirements: ["donor_set", "recipient_set"],
              },
              poor_quality_image_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
            }),
          }),
        }),
      ],
    });

    assert.equal(composed.metrics.casesAuditReady, 1);
    assert.equal(composed.metrics.casesBeforeAfterReady, 1);
    assert.equal(composed.metrics.casesWithImagingGaps, 1);
    assert.equal(composed.metrics.averageImagingCompletenessScore, 75);

    const completeRow = composed.tableRows.find((row) => row.caseId === CASE);
    const partialRow = composed.tableRows.find(
      (row) => row.caseId === "88888888-8888-4888-8888-888888888888"
    );
    assert.equal(completeRow?.imagingCompletenessLabel, "Complete");
    assert.equal(completeRow?.imagingAuditReadinessLabel, "Audit ready");
    assert.equal(partialRow?.imagingCompletenessLabel, "Partial");
    assert.equal(partialRow?.imagingAuditReadinessLabel, "Building");
    assert.equal(partialRow?.poorQualityImageCount, 1);
  });

  it("read-only loader does not import publisher write paths", () => {
    const loaderPath = join(
      process.cwd(),
      "src/lib/outcomeIntelligence/surgeryIntelligenceDashboardLoader.server.ts"
    );
    const source = readFileSync(loaderPath, "utf8");
    assert.equal(source.includes("publishSurgeryCaseIntelligenceFacts"), false);
    assert.equal(source.includes("tryPublishSurgeryCaseIntelligenceFactsForSurgery"), false);
    assert.equal(source.includes("recordAnalyticsEvent"), false);
    assert.equal(source.includes("getAnalyticsEvents"), true);
  });
});