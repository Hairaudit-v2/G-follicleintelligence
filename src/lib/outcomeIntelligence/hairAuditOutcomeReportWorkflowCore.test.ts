import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { resolveHairAuditLinkForSurgery } from "./hairAuditLinkCore";
import {
  planHairAuditOutcomeReportLink,
  resolveHairAuditOutcomeReportWorkflow,
} from "./hairAuditOutcomeReportWorkflowCore";
import type { LongitudinalOutcomeSummaryFacts } from "./longitudinalOutcomeComparisonCore";
import type { SurgeryCaseIntelligenceFacts } from "./surgeryCaseFactsCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const CASE = "22222222-2222-4222-8222-222222222222";
const SURGERY = "44444444-4444-4444-8444-444444444444";
const LEGACY_HAIRAUDIT = "66666666-6666-4666-8666-666666666666";
const LEGACY_REPORT = "77777777-7777-4777-8777-777777777777";
const STRUCTURED_REPORT = "88888888-8888-4888-8888-888888888888";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function readyLongitudinalSummary(): LongitudinalOutcomeSummaryFacts {
  return {
    baseline_image_set: {
      image_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01"],
      usable_image_count: 2,
      poor_quality_count: 0,
      present_views: ["front", "top"],
      missing_required_views: [],
      complete: true,
    },
    immediate_post_op_image_set: {
      image_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06"],
      usable_image_count: 2,
      poor_quality_count: 0,
      present_views: ["front", "top"],
      missing_required_views: [],
      complete: true,
    },
    follow_up_image_set: {
      image_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08"],
      usable_image_count: 2,
      poor_quality_count: 0,
      present_views: ["front", "top"],
      missing_required_views: [],
      complete: true,
    },
    comparison_readiness: {
      ready_for_comparison: true,
      outcome_measured: true,
      missing_comparison_views: [],
    },
    donor_recovery_evidence_status: "outcome_measured",
    recipient_growth_evidence_status: "outcome_measured",
    before_after_ready: true,
    hairaudit_report_ready: true,
    follow_up_windows: [
      {
        window: "month_12",
        due: false,
        captured: true,
        captured_at: "2026-07-01T10:00:00.000Z",
        ready_for_comparison: true,
        outcome_measured: true,
      },
    ],
    active_follow_up_window: "month_12",
    missing_outcome_evidence: [],
    hairaudit_case_id: LEGACY_HAIRAUDIT,
    hairaudit_report_id: LEGACY_REPORT,
  };
}

function baseFacts(
  overrides: Partial<SurgeryCaseIntelligenceFacts> = {}
): SurgeryCaseIntelligenceFacts {
  return {
    facts_version: "surgery_case_intelligence_facts_v1",
    tenant_id: TENANT,
    patient_id: null,
    case_id: CASE,
    surgery_id: SURGERY,
    booking_id: null,
    procedure_date: "2025-07-01",
    final_reviewed_graft_count: 120,
    graft_tray_ai_estimate: 120,
    graft_tray_manual_count: 118,
    graft_count_source: "ai",
    mismatch_band: "within_tolerance",
    confidence_band: "high",
    image_quality: "suitable",
    reviewer_id: null,
    reviewer_label: null,
    reviewed_at: null,
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
    surgeon_fi_user_id: null,
    team_fi_user_ids: [],
    graft_tray_image_ids: [],
    graft_tray_link_ids: [],
    graft_tray_links: [],
    graft_tray_outcome_facts: [],
    confidence_level: "high",
    imaging_intelligence_summary: null,
    longitudinal_outcome_summary: readyLongitudinalSummary(),
    before_after_ready: true,
    donor_recovery_ready: true,
    recipient_growth_ready: true,
    follow_up_window_status: readyLongitudinalSummary().follow_up_windows,
    missing_outcome_evidence: [],
    ...overrides,
  };
}

describe("hairAuditOutcomeReportWorkflowCore", () => {
  it("ready longitudinal facts produce ready_for_review", () => {
    const hairAuditLink = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT },
    });

    const workflow = resolveHairAuditOutcomeReportWorkflow({
      tenantId: TENANT,
      facts: baseFacts({
        longitudinal_outcome_summary: {
          ...readyLongitudinalSummary(),
          hairaudit_report_ready: true,
          hairaudit_report_id: null,
        },
      }),
      hairAuditLink,
    });

    assert.equal(workflow.report_ready, true);
    assert.equal(workflow.report_status, "ready_for_review");
    assert.equal(workflow.report_link, null);
    assert.equal(workflow.recommended_action, "create_or_link_report");
  });

  it("missing donor/recipient/follow-up evidence blocks readiness", () => {
    const hairAuditLink = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT },
    });

    const workflow = resolveHairAuditOutcomeReportWorkflow({
      tenantId: TENANT,
      facts: baseFacts({
        longitudinal_outcome_summary: {
          ...readyLongitudinalSummary(),
          hairaudit_report_ready: false,
          comparison_readiness: {
            ready_for_comparison: false,
            outcome_measured: false,
            missing_comparison_views: ["follow_up:top"],
          },
        },
        missing_outcome_evidence: [
          "donor_follow_up",
          "recipient_follow_up",
          "follow_up_evidence",
        ],
        donor_recovery_ready: false,
        recipient_growth_ready: false,
      }),
      hairAuditLink,
    });

    assert.equal(workflow.report_ready, false);
    assert.equal(workflow.report_status, "missing_evidence");
    assert.ok(workflow.missing_evidence.includes("donor_follow_up"));
    assert.ok(workflow.missing_evidence.includes("recipient_follow_up"));
    assert.equal(workflow.recommended_action, "mark_missing_follow_up_imaging");
  });

  it("existing legacy report opens unchanged", () => {
    const hairAuditLink = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        report_id: LEGACY_REPORT,
      },
    });

    const workflow = resolveHairAuditOutcomeReportWorkflow({
      tenantId: TENANT,
      facts: baseFacts(),
      hairAuditLink,
      reportContext: { fiReportId: LEGACY_REPORT, reportStatus: "complete" },
    });

    assert.equal(workflow.report_status, "report_complete");
    assert.equal(workflow.report_link, `/fi-admin/${TENANT}/audit/${LEGACY_REPORT}`);
    assert.equal(workflow.recommended_action, "open_report");

    const planned = planHairAuditOutcomeReportLink({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseId: CASE,
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        report_id: LEGACY_REPORT,
      },
      hairAuditLink,
      fiReportId: STRUCTURED_REPORT,
      dryRun: true,
    });
    assert.equal(planned.outcome.kind, "skipped_legacy_report");
    assert.equal(
      (planned.outcome as { fiReportId: string }).fiReportId,
      LEGACY_REPORT
    );
  });

  it("conflict is surfaced, not overwritten", () => {
    const hairAuditLink = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        report_id: LEGACY_REPORT,
        hair_audit_link: {
          hairaudit_case_id: LEGACY_HAIRAUDIT,
          fi_report_id: STRUCTURED_REPORT,
          link_origin: "structured",
        },
      },
    });

    const workflow = resolveHairAuditOutcomeReportWorkflow({
      tenantId: TENANT,
      facts: baseFacts(),
      hairAuditLink,
    });

    assert.equal(workflow.report_status, "linkage_conflict");
    assert.equal(workflow.report_ready, false);
    assert.equal(workflow.report_link, null);
    assert.equal(workflow.recommended_action, "view_missing_evidence_checklist");

    const planned = planHairAuditOutcomeReportLink({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseId: CASE,
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        report_id: LEGACY_REPORT,
        hair_audit_link: {
          fi_report_id: STRUCTURED_REPORT,
          link_origin: "structured",
        },
      },
      hairAuditLink,
      fiReportId: STRUCTURED_REPORT,
      dryRun: false,
    });
    assert.equal(planned.outcome.kind, "skipped_conflict");
  });

  it("explicit create/link action is idempotent", () => {
    const hairAuditLink = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        hair_audit_link: {
          hairaudit_case_id: LEGACY_HAIRAUDIT,
          fi_report_id: LEGACY_REPORT,
          link_origin: "structured",
        },
      },
    });

    const planned = planHairAuditOutcomeReportLink({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseId: CASE,
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        hair_audit_link: {
          hairaudit_case_id: LEGACY_HAIRAUDIT,
          fi_report_id: LEGACY_REPORT,
          link_origin: "structured",
        },
      },
      hairAuditLink,
      fiReportId: LEGACY_REPORT,
      dryRun: false,
    });

    assert.equal(planned.outcome.kind, "skipped_already_linked");
    assert.equal(
      (planned.outcome as { fiReportId: string }).fiReportId,
      LEGACY_REPORT
    );
  });

  it("dashboard loader remains read-only", () => {
    const loader = readRepoFile(
      "src/lib/outcomeIntelligence/surgeryIntelligenceDashboardLoader.server.ts"
    );
    const page = readRepoFile(
      "app/(fi-admin)/fi-admin/[tenantId]/surgery-os/intelligence/page.tsx"
    );

    assert.equal(loader.includes("linkHairAuditOutcomeReportForSurgery"), false);
    assert.equal(loader.includes("linkHairAuditOutcomeReportAction"), false);
    assert.equal(page.includes("linkHairAuditOutcomeReportForSurgery"), false);
    assert.equal(page.includes("SurgeryIntelligenceOutcomeReportActions"), false);
    assert.equal(loader.includes("getAnalyticsEvents"), true);
  });
});