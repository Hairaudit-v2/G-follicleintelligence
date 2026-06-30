import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildActiveTherapyPlanSummary,
  toPatientTherapyEventRow,
  toPatientTherapyPlanItemRow,
} from "../medicationOs/medicationOsMappers";
import type { PatientTherapyPlanRow } from "../medicationOs/medicationOsTypes";
import {
  buildPatientTwinMedicationsSection,
  emptyPatientTwinMedicationsSection,
  PATIENT_TWIN_MEDICATION_OS_ACTIVE_ITEMS_CAP,
  PATIENT_TWIN_MEDICATION_OS_EVENTS_PREVIEW_CAP,
} from "./patientTwinMedicationOs";

describe("patientTwinMedicationOs", () => {
  it("emptyPatientTwinMedicationsSection has zero counts and default caps", () => {
    const e = emptyPatientTwinMedicationsSection();
    assert.equal(e.active_plan_count, 0);
    assert.equal(e.active_items.length, 0);
    assert.equal(e.therapy_events_preview.length, 0);
    assert.equal(e.active_item_cap, PATIENT_TWIN_MEDICATION_OS_ACTIVE_ITEMS_CAP);
    assert.equal(e.therapy_events_preview_cap, PATIENT_TWIN_MEDICATION_OS_EVENTS_PREVIEW_CAP);
  });

  it("buildPatientTwinMedicationsSection caps active items", () => {
    const plan: PatientTherapyPlanRow = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      patient_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      case_id: null,
      consultation_id: null,
      surgery_plan_id: null,
      plan_type: "maintenance",
      title: "Plan A",
      status: "active",
      source: "manual",
      valid_from: null,
      valid_until: null,
      surgery_anchor_date: null,
      metadata: {},
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    const items = Array.from({ length: 10 }, (_, i) =>
      toPatientTherapyPlanItemRow({
        id: randomUUID(),
        tenant_id: plan.tenant_id,
        plan_id: plan.id,
        canonical_code: `code_${i}`,
        role: "continuous",
        dosing_summary: null,
        sessions_planned: null,
        sessions_completed: 0,
        day_offset_start: null,
        day_offset_end: null,
        pathology_gate: null,
        prescription_id: i === 0 ? "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" : null,
        prescription_item_id: i === 0 ? "ffffffff-ffff-4fff-8fff-ffffffffffff" : null,
        sort_order: i,
        metadata: {},
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      })
    );
    const summary = buildActiveTherapyPlanSummary({
      activePlans: [plan],
      itemsByPlanId: new Map([[plan.id, items]]),
      displayNameByCanonicalCode: new Map(),
    });
    const out = buildPatientTwinMedicationsSection(summary, [], { activeItems: 3 });
    assert.equal(out.active_items.length, 3);
    assert.equal(out.active_plan_count, 1);
    assert.equal(out.active_items[0]?.prescription_id, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  });

  it("buildPatientTwinMedicationsSection maps therapy event previews", () => {
    const ev = toPatientTherapyEventRow({
      id: "11111111-1111-4111-8111-111111111111",
      tenant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      patient_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      case_id: null,
      consultation_id: null,
      plan_id: null,
      plan_item_id: null,
      prescription_id: null,
      prescription_item_id: null,
      pathology_request_id: null,
      pathology_result_id: null,
      event_type: "plan_activated",
      canonical_code: null,
      occurred_at: "2026-06-01T12:00:00Z",
      actor_user_id: null,
      detail: {},
      metadata: {},
      created_at: "2026-06-01T12:00:01Z",
    });
    const summary = buildActiveTherapyPlanSummary({
      activePlans: [],
      itemsByPlanId: new Map(),
      displayNameByCanonicalCode: new Map(),
    });
    const out = buildPatientTwinMedicationsSection(summary, [ev, ev], { eventsPreview: 1 });
    assert.equal(out.therapy_events_preview.length, 1);
    assert.equal(out.therapy_events_preview[0]?.source_table, "fi_patient_therapy_events");
    assert.equal(out.therapy_events_preview[0]?.event_type, "plan_activated");
  });
});
