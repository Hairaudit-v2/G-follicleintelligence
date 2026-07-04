import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { resolveHairAuditLinkForSurgery } from "./hairAuditLinkCore";
import { buildLongitudinalOutcomeComparison } from "./longitudinalOutcomeComparisonCore";
import {
  parsePublishedSurgeryCaseIntelligenceEvent,
  composeSurgeryIntelligenceDashboardFromEvents,
} from "./surgeryIntelligenceDashboardDerive";
import { SURGERY_CASE_INTELLIGENCE_FACTS_VERSION } from "./surgeryCaseFactsCore";
import { SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE } from "./surgeryCaseFactsPublisherCore";
import { surgeryCaseIntelligenceFactsSchema } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

const PUBLISH_MARKERS = [
  "publishSurgeryCaseIntelligenceFacts",
  "tryPublishSurgeryCaseIntelligenceFactsForSurgery",
  "processSurgeryCaseIntelligenceBackfillItem",
  "runSurgeryIntelligenceBackfill",
  "recordAnalyticsEvent",
] as const;

const TENANT = "11111111-1111-4111-8111-111111111111";
const CASE = "22222222-2222-4222-8222-222222222222";
const SURGERY = "44444444-4444-4444-8444-444444444444";
const LEGACY_HAIRAUDIT = "66666666-6666-4666-8666-666666666666";
const STRUCTURED_HAIRAUDIT = "77777777-7777-4777-8777-777777777777";
const REFERENCE_DATE = "2026-07-05T12:00:00.000Z";

const IMG_BASELINE_FRONT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01";
const IMG_BASELINE_TOP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02";
const IMG_DONOR_BASELINE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03";
const IMG_IMMEDIATE_FRONT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06";
const IMG_IMMEDIATE_TOP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07";
const IMG_FOLLOWUP_FRONT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08";
const IMG_FOLLOWUP_TOP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09";
const IMG_FOLLOWUP_DONOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function image(
  id: string,
  overrides: Record<string, string | boolean | null | undefined> = {}
) {
  return {
    imageId: id,
    canonicalCategory: overrides.canonicalCategory as string | undefined,
    surgicalEvent: overrides.surgicalEvent as string | undefined,
    followUpInterval: overrides.followUpInterval as string | undefined,
    qualityStatus: overrides.qualityStatus as string | undefined,
    isClinicallyUsable: overrides.isClinicallyUsable as boolean | null | undefined,
    capturedAt: overrides.capturedAt as string | undefined,
  };
}

function completeLongitudinalImages() {
  return [
    image(IMG_BASELINE_FRONT, {
      surgicalEvent: "pre_op",
      canonicalCategory: "front",
      qualityStatus: "acceptable",
    }),
    image(IMG_BASELINE_TOP, {
      surgicalEvent: "pre_op",
      canonicalCategory: "top",
      qualityStatus: "acceptable",
    }),
    image(IMG_DONOR_BASELINE, {
      surgicalEvent: "donor_mapping",
      canonicalCategory: "donor",
      qualityStatus: "acceptable",
    }),
    image(IMG_IMMEDIATE_FRONT, {
      surgicalEvent: "immediate_post_op",
      canonicalCategory: "front",
      qualityStatus: "acceptable",
    }),
    image(IMG_IMMEDIATE_TOP, {
      surgicalEvent: "immediate_post_op",
      canonicalCategory: "top",
      qualityStatus: "acceptable",
    }),
    image(IMG_FOLLOWUP_FRONT, {
      surgicalEvent: "month_12_outcome",
      canonicalCategory: "front",
      followUpInterval: "month_12",
      qualityStatus: "acceptable",
      capturedAt: "2026-07-01T10:00:00.000Z",
    }),
    image(IMG_FOLLOWUP_TOP, {
      surgicalEvent: "month_12_outcome",
      canonicalCategory: "top",
      followUpInterval: "month_12",
      qualityStatus: "acceptable",
      capturedAt: "2026-07-01T10:00:00.000Z",
    }),
    image(IMG_FOLLOWUP_DONOR, {
      surgicalEvent: "month_12_outcome",
      canonicalCategory: "donor",
      followUpInterval: "month_12",
      qualityStatus: "acceptable",
      capturedAt: "2026-07-01T10:00:00.000Z",
    }),
  ];
}

function legacyFactsPayloadWithoutLongitudinalSummary() {
  return {
    facts_version: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
    tenant_id: TENANT,
    patient_id: null,
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
  };
}

describe("surgeryIntelligenceLongitudinalOutcomeReleaseReadiness", () => {
  it("read-only dashboard does not publish or rebuild facts on load", () => {
    const loader = readRepoFile(
      "src/lib/outcomeIntelligence/surgeryIntelligenceDashboardLoader.server.ts"
    );
    const page = readRepoFile(
      "app/(fi-admin)/fi-admin/[tenantId]/surgery-os/intelligence/page.tsx"
    );

    for (const marker of PUBLISH_MARKERS) {
      assert.equal(loader.includes(marker), false, `loader must not reference ${marker}`);
      assert.equal(page.includes(marker), false, `page must not reference ${marker}`);
    }

    assert.equal(loader.includes("getAnalyticsEvents"), true);
    assert.equal(loader.includes("composeSurgeryIntelligenceDashboardFromEvents"), true);
    assert.equal(page.includes("loadSurgeryIntelligenceDashboard"), true);
    assert.equal(page.includes("runSurgeryIntelligenceBackfill"), false);
  });

  it("older published facts without longitudinal_outcome_summary still validate and parse", () => {
    const payload = legacyFactsPayloadWithoutLongitudinalSummary();

    const parsed = surgeryCaseIntelligenceFactsSchema.parse(payload);
    assert.equal(parsed.longitudinal_outcome_summary, null);
    assert.equal(parsed.before_after_ready, false);
    assert.deepEqual(parsed.follow_up_window_status, []);
    assert.deepEqual(parsed.missing_outcome_evidence, []);

    const event = parsePublishedSurgeryCaseIntelligenceEvent(
      {
        id: "event-legacy-longitudinal",
        tenant_id: TENANT,
        clinic_id: null,
        module_name: "surgery_os",
        event_type: SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE,
        entity_id: CASE,
        entity_type: "case",
        event_value: 120,
        event_metadata: {
          source: "surgery_case_intelligence",
          facts_version: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
          last_published_at: "2026-07-04T10:00:00.000Z",
          payload_json: payload,
        },
        occurred_at: "2026-07-04T10:00:00.000Z",
        created_at: "2026-07-04T10:00:00.000Z",
      },
      TENANT
    );

    assert.ok(event);
    assert.equal(event.longitudinalOutcomeSummary, null);
    assert.equal(event.beforeAfterReady, false);

    const composed = composeSurgeryIntelligenceDashboardFromEvents({
      tenantId: TENANT,
      events: [
        {
          id: "event-legacy-longitudinal",
          tenant_id: TENANT,
          clinic_id: null,
          module_name: "surgery_os",
          event_type: SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE,
          entity_id: CASE,
          entity_type: "case",
          event_value: 120,
          event_metadata: {
            source: "surgery_case_intelligence",
            facts_version: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
            last_published_at: "2026-07-04T10:00:00.000Z",
            payload_json: payload,
          },
          occurred_at: "2026-07-04T10:00:00.000Z",
          created_at: "2026-07-04T10:00:00.000Z",
        },
      ],
      filters: {},
    });

    assert.equal(composed.tableRows.length, 1);
    assert.equal(composed.tableRows[0]?.longitudinalComparisonLabel, "Building evidence");
    assert.equal(composed.tableRows[0]?.followUpDue, false);
    assert.equal(composed.metrics.casesDueForFollowUp, 0);
  });

  it("legacy HairAudit link wins on conflict for longitudinal outcome resolution", () => {
    const core = readRepoFile(
      "src/lib/outcomeIntelligence/longitudinalOutcomeComparisonCore.ts"
    );
    assert.equal(core.includes("resolveHairAuditLinkForSurgery"), true);

    const resolution = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        hair_audit_link: {
          hairaudit_case_id: STRUCTURED_HAIRAUDIT,
          link_origin: "structured",
        },
      },
    });
    assert.equal(resolution.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(resolution.linkage_conflict, true);
    assert.notEqual(resolution.hairaudit_case_id, STRUCTURED_HAIRAUDIT);

    const comparison = buildLongitudinalOutcomeComparison({
      tenantId: TENANT,
      surgeryId: SURGERY,
      procedureDate: "2025-07-01",
      images: completeLongitudinalImages(),
      hairAuditLink: {
        tenantId: TENANT,
        surgeryId: SURGERY,
        caseMetadata: {
          hairaudit_case_id: LEGACY_HAIRAUDIT,
          hair_audit_link: {
            hairaudit_case_id: STRUCTURED_HAIRAUDIT,
            link_origin: "structured",
          },
        },
      },
      referenceDate: REFERENCE_DATE,
    });

    assert.equal(comparison.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(comparison.comparison_readiness.ready_for_comparison, false);
    assert.ok(comparison.missing_outcome_evidence.includes("hairaudit_linkage_conflict"));
  });

  it("poor-quality follow-up does not mark outcome measured", () => {
    const comparison = buildLongitudinalOutcomeComparison({
      tenantId: TENANT,
      surgeryId: SURGERY,
      procedureDate: "2025-07-01",
      images: completeLongitudinalImages().map((entry) =>
        entry.imageId === IMG_FOLLOWUP_TOP
          ? { ...entry, qualityStatus: "poor", isClinicallyUsable: false }
          : entry
      ),
      referenceDate: REFERENCE_DATE,
    });

    assert.equal(comparison.comparison_readiness.outcome_measured, false);
    assert.equal(comparison.comparison_readiness.ready_for_comparison, false);
    assert.ok(
      comparison.missing_outcome_evidence.includes("follow_up_comparison_views") ||
        comparison.missing_outcome_evidence.includes("follow_up_poor_quality")
    );
  });

  it("missing donor follow-up blocks donor recovery readiness", () => {
    const comparison = buildLongitudinalOutcomeComparison({
      tenantId: TENANT,
      surgeryId: SURGERY,
      procedureDate: "2025-07-01",
      images: completeLongitudinalImages().filter(
        (entry) => entry.imageId !== IMG_FOLLOWUP_DONOR
      ),
      referenceDate: REFERENCE_DATE,
    });

    assert.equal(comparison.donor_recovery_evidence_status, "blocked_missing_evidence");
    assert.ok(comparison.missing_outcome_evidence.includes("donor_follow_up"));
  });
});