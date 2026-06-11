import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildActiveTherapyPlanSummary,
  parsePlanItemRole,
  parsePlanStatus,
  parseTherapyEventType,
  therapyEventPreviewTitle,
  toMedicationOsCanonicalRow,
  toPatientTherapyEventPreview,
  toPatientTherapyEventRow,
  toPatientTherapyPlanItemRow,
  toPatientTherapyPlanRow,
} from "./medicationOsMappers";
import type { PatientTherapyPlanRow } from "./medicationOsTypes";

describe("medicationOsMappers", () => {
  it("parses unknown enums to safe defaults", () => {
    assert.equal(parsePlanStatus("not-a-status"), "draft");
    assert.equal(parsePlanItemRole("multi_session"), "continuous");
    assert.equal(parseTherapyEventType(undefined), "plan_created");
  });

  it("toMedicationOsCanonicalRow maps metadata object", () => {
    const row = toMedicationOsCanonicalRow({
      id: "a",
      tenant_id: "t",
      canonical_code: "finasteride",
      display_name: "Finasteride",
      therapy_track: "maintenance",
      default_route: "oral",
      catalogue_id: null,
      active: true,
      metadata: { tier: 1 },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    assert.equal(row.canonical_code, "finasteride");
    assert.equal(row.metadata.tier, 1);
  });

  it("therapyEventPreviewTitle covers therapy_started", () => {
    assert.equal(therapyEventPreviewTitle("therapy_started"), "Therapy started");
  });

  it("toPatientTherapyEventPreview uses title helper", () => {
    const event = toPatientTherapyEventRow({
      id: "e1",
      tenant_id: "t1",
      patient_id: "p1",
      case_id: null,
      consultation_id: null,
      plan_id: "pl1",
      plan_item_id: null,
      prescription_id: null,
      prescription_item_id: null,
      pathology_request_id: null,
      pathology_result_id: null,
      event_type: "session_completed",
      canonical_code: "prp",
      occurred_at: "2026-06-01T12:00:00Z",
      actor_user_id: null,
      detail: {},
      metadata: {},
      created_at: "2026-06-01T12:00:01Z",
    });
    const prev = toPatientTherapyEventPreview(event);
    assert.equal(prev.title, "Session completed");
    assert.equal(prev.plan_id, "pl1");
  });

  it("buildActiveTherapyPlanSummary joins display names", () => {
    const plan: PatientTherapyPlanRow = {
      id: "plan-1",
      tenant_id: "t",
      patient_id: "p",
      case_id: null,
      consultation_id: null,
      surgery_plan_id: null,
      plan_type: "maintenance",
      title: "Hair maintenance",
      status: "active",
      source: "manual",
      valid_from: null,
      valid_until: null,
      surgery_anchor_date: null,
      metadata: {},
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    const item = toPatientTherapyPlanItemRow({
      id: "li-1",
      tenant_id: "t",
      plan_id: "plan-1",
      canonical_code: "finasteride",
      role: "continuous",
      dosing_summary: "1 mg daily",
      sessions_planned: null,
      sessions_completed: 0,
      day_offset_start: null,
      day_offset_end: null,
      pathology_gate: null,
      prescription_id: null,
      prescription_item_id: null,
      sort_order: 0,
      metadata: {},
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    });
    const display = new Map([["finasteride", "Finasteride (display)"]]);
    const summary = buildActiveTherapyPlanSummary({
      activePlans: [plan],
      itemsByPlanId: new Map([["plan-1", [item]]]),
      displayNameByCanonicalCode: display,
    });
    assert.equal(summary.active_plan_count, 1);
    assert.equal(summary.plans[0]?.items[0]?.display_name, "Finasteride (display)");
    assert.equal(summary.plans[0]?.items[0]?.dosing_summary, "1 mg daily");
  });

  it("buildActiveTherapyPlanSummary falls back to canonical_code when no display map", () => {
    const plan = toPatientTherapyPlanRow({
      id: "p2",
      tenant_id: "t",
      patient_id: "pt",
      case_id: null,
      consultation_id: null,
      surgery_plan_id: null,
      plan_type: "post_operative",
      title: "Post-op",
      status: "active",
      source: "surgery_postop_bundle",
      valid_from: null,
      valid_until: null,
      surgery_anchor_date: "2026-05-01",
      metadata: {},
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    });
    const item = toPatientTherapyPlanItemRow({
      id: "i2",
      tenant_id: "t",
      plan_id: "p2",
      canonical_code: "unknown_code",
      role: "course",
      dosing_summary: null,
      sessions_planned: 5,
      sessions_completed: 2,
      day_offset_start: 0,
      day_offset_end: 7,
      pathology_gate: "requires_normal_lft",
      prescription_id: null,
      prescription_item_id: null,
      sort_order: 1,
      metadata: {},
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    });
    const summary = buildActiveTherapyPlanSummary({
      activePlans: [plan],
      itemsByPlanId: new Map([["p2", [item]]]),
      displayNameByCanonicalCode: new Map(),
    });
    assert.equal(summary.plans[0]?.items[0]?.display_name, "unknown_code");
    assert.equal(summary.plans[0]?.surgery_anchor_date, "2026-05-01");
  });
});
