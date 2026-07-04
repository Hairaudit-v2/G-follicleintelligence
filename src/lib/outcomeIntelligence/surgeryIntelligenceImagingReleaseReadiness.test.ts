import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { resolveHairAuditLinkForSurgery } from "./hairAuditLinkCore";
import {
  parsePublishedSurgeryCaseIntelligenceEvent,
  composeSurgeryIntelligenceDashboardFromEvents,
} from "./surgeryIntelligenceDashboardDerive";
import { SURGERY_CASE_INTELLIGENCE_FACTS_VERSION } from "./surgeryCaseFactsCore";
import { SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE } from "./surgeryCaseFactsPublisherCore";
import { validateSurgeryCaseIntelligenceFactsForPublish } from "./surgeryCaseFactsPublisherCore";
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

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function legacyFactsPayloadWithoutImagingSummary() {
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
  };
}

describe("surgeryIntelligenceImagingReleaseReadiness", () => {
  it("dashboard loader stays read-only and does not publish on load", () => {
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

  it("imaging summary core resolves HairAudit links legacy-first via compatibility resolver", () => {
    const core = readRepoFile(
      "src/lib/outcomeIntelligence/surgeryImagingIntelligenceSummaryCore.ts"
    );
    assert.equal(core.includes("resolveHairAuditLinkForSurgery"), true);
    assert.equal(core.includes("buildStructuredHairAuditLinkFromLegacy"), false);

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
  });

  it("older published facts without imaging_intelligence_summary still validate and parse", () => {
    const payload = legacyFactsPayloadWithoutImagingSummary();

    surgeryCaseIntelligenceFactsSchema.parse(payload);
    const validated = validateSurgeryCaseIntelligenceFactsForPublish(payload);
    assert.equal(validated.imaging_intelligence_summary, undefined);

    const parsed = parsePublishedSurgeryCaseIntelligenceEvent(
      {
        id: "event-legacy",
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

    assert.ok(parsed);
    assert.equal(parsed.imagingIntelligenceSummary, null);

    const composed = composeSurgeryIntelligenceDashboardFromEvents({
      tenantId: TENANT,
      events: [
        {
          id: "event-legacy",
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
    assert.equal(composed.tableRows[0]?.imagingCompletenessScore, 0);
    assert.equal(composed.tableRows[0]?.imagingCompletenessLabel, "Not started");
    assert.equal(composed.metrics.casesAuditReady, 0);
  });
});