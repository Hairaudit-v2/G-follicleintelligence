import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  consultationEligibleForCrmCompleteAdvance,
  findPipelineStageBySlug,
  isConsultationCrmCompleteStatus,
  shouldAdvanceCrmLeadToTargetSortOrder,
  timelyConsultationBookingEligibleForCrmAdvance,
} from "@/src/lib/crm/crmStageAutoAdvancePolicy";
import { defaultHairRestorationPipelineDefinitions } from "@/src/lib/crm/pipelineSeedPayload";

const LEAD_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function stageRows() {
  const defs = defaultHairRestorationPipelineDefinitions();
  const ids: Record<string, string> = {
    new: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    consult_scheduled: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    consult_completed: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    deposit_or_booked: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    won_closed: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  };
  return defs.map((d) => ({
    id: ids[d.slug] ?? `00000000-0000-4000-8000-${String(d.sort_order).padStart(12, "0")}`,
    slug: d.slug,
    sort_order: d.sort_order,
  }));
}

function bookingBase(overrides: Partial<FiBookingRow> = {}): FiBookingRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "11111111-1111-4111-8111-111111111111",
    lead_id: LEAD_ID,
    person_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    patient_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    case_id: null,
    clinic_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    room_id: null,
    room_required: false,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: "consultation",
    booking_status: "scheduled",
    title: "Consult",
    description: null,
    start_at: "2026-06-01T10:00:00.000Z",
    end_at: "2026-06-01T11:00:00.000Z",
    timezone: null,
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CRM stage auto-advance policy", () => {
  it("shouldAdvanceCrmLeadToTargetSortOrder respects pipeline order", () => {
    const scheduled = findPipelineStageBySlug(stageRows(), "consult_scheduled");
    const completed = findPipelineStageBySlug(stageRows(), "consult_completed");
    assert.ok(scheduled && completed);
    assert.equal(shouldAdvanceCrmLeadToTargetSortOrder(null, scheduled.sort_order), true);
    assert.equal(shouldAdvanceCrmLeadToTargetSortOrder(0, scheduled.sort_order), true);
    assert.equal(shouldAdvanceCrmLeadToTargetSortOrder(scheduled.sort_order, scheduled.sort_order), false);
    assert.equal(shouldAdvanceCrmLeadToTargetSortOrder(completed.sort_order, scheduled.sort_order), false);
  });

  it("isConsultationCrmCompleteStatus accepts completed", () => {
    assert.equal(isConsultationCrmCompleteStatus("completed"), true);
    assert.equal(isConsultationCrmCompleteStatus("draft"), false);
  });

  it("does not advance deposit_or_booked or won_closed toward consult_completed", () => {
    const deposit = findPipelineStageBySlug(stageRows(), "deposit_or_booked");
    const won = findPipelineStageBySlug(stageRows(), "won_closed");
    const completed = findPipelineStageBySlug(stageRows(), "consult_completed");
    assert.ok(deposit && won && completed);
    assert.equal(shouldAdvanceCrmLeadToTargetSortOrder(deposit.sort_order, completed.sort_order), false);
    assert.equal(shouldAdvanceCrmLeadToTargetSortOrder(won.sort_order, completed.sort_order), false);
  });
});

describe("timelyConsultationBookingEligibleForCrmAdvance", () => {
  it("allows consultation bookings with lead context", () => {
    assert.equal(timelyConsultationBookingEligibleForCrmAdvance(bookingBase()), true);
  });

  it("skips non-consultation booking types", () => {
    assert.equal(timelyConsultationBookingEligibleForCrmAdvance(bookingBase({ booking_type: "prp" })), false);
  });

  it("skips cancelled bookings", () => {
    assert.equal(
      timelyConsultationBookingEligibleForCrmAdvance(
        bookingBase({ booking_status: "cancelled", cancelled_at: "2026-06-01T09:00:00.000Z" })
      ),
      false
    );
  });

  it("skips no_show bookings", () => {
    assert.equal(timelyConsultationBookingEligibleForCrmAdvance(bookingBase({ booking_status: "no_show" })), false);
  });
});

describe("consultationEligibleForCrmCompleteAdvance", () => {
  it("requires completed status and lead_id", () => {
    assert.equal(
      consultationEligibleForCrmCompleteAdvance({ lead_id: LEAD_ID, status: "completed" }),
      true
    );
    assert.equal(consultationEligibleForCrmCompleteAdvance({ lead_id: LEAD_ID, status: "draft" }), false);
    assert.equal(consultationEligibleForCrmCompleteAdvance({ lead_id: null, status: "completed" }), false);
  });
});
