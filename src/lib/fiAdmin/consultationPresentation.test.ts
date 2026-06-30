import assert from "node:assert/strict";
import test from "node:test";

import type { ConsultationIndexRow } from "@/src/lib/consultations/consultationLoaders.server";
import type { ConsultationDashboardPayload } from "@/src/lib/fiAdmin/consultationDashboardTypes";
import {
  buildConsultationAttentionPriorities,
  buildConsultationHealthCards,
  buildClinicalPlanningQueueItems,
  deriveConsultationFlowState,
  hasUrgentConsultationAttention,
} from "@/src/lib/fiAdmin/consultationPresentation";

function row(overrides: Partial<ConsultationIndexRow> = {}): ConsultationIndexRow {
  return {
    id: "c-1",
    tenant_id: "t-1",
    person_id: null,
    patient_id: "p-1",
    lead_id: null,
    case_id: null,
    booking_id: null,
    consultation_type: "scalp_hair_transplant",
    status: "draft",
    consultant_name: null,
    consultant_staff_id: null,
    consultation_date: "2026-06-23",
    structured_data: {},
    live_notes: null,
    recommendation_notes: null,
    quote_data: {},
    created_by: null,
    updated_by: null,
    created_at: "2026-06-20T10:00:00.000Z",
    updated_at: "2026-06-23T08:00:00.000Z",
    archived_at: null,
    consultation_type_label: "Scalp hair transplant",
    subject_line: "Jane Doe",
    patient_display_name: "Jane Doe",
    lead_display_name: null,
    link_headline: "Jane Doe",
    consultant_display_name: null,
    ...overrides,
  };
}

function emptyPayload(
  overrides: Partial<ConsultationDashboardPayload> = {}
): ConsultationDashboardPayload {
  return {
    todayYmd: "2026-06-23",
    calendarTimezone: "UTC",
    consultations: [],
    conversion: {
      window: {
        calendarTimezone: "UTC",
        todayYmd: "2026-06-23",
        ymdPast90: "2026-03-25",
        ymdFuture30: "2026-07-23",
        rangeStartIso: "2026-03-25T00:00:00.000Z",
        rangeEndIso: "2026-07-24T00:00:00.000Z",
      },
      columns: {
        consultation_booked: [],
        consultation_completed: [],
        quote_drafted: [],
        quote_sent: [],
        quote_accepted: [],
        surgery_booked: [],
        lost: [],
      },
      kpis: {
        consultationsBookedNext30Days: 0,
        consultationsCompletedLast30Days: 0,
        quotesSent: 0,
        quotesAccepted: 0,
        surgeryBookedFromConsults: 0,
        conversionRateQuoteToSurgery: null,
        conversionRateLabel: "Not enough quote/surgery signals for a reliable rate",
      },
    },
    ...overrides,
  };
}

test("buildConsultationHealthCards returns six cards", () => {
  const cards = buildConsultationHealthCards(
    "/fi-admin/t",
    emptyPayload({ consultations: [row()] })
  );
  assert.equal(cards.length, 6);
  assert.equal(cards[0].label, "Consultations today");
});

test("deriveConsultationFlowState maps draft today without progress to scheduled", () => {
  assert.equal(deriveConsultationFlowState(row(), "2026-06-23"), "scheduled");
});

test("deriveConsultationFlowState maps in_progress today to in_consultation", () => {
  assert.equal(
    deriveConsultationFlowState(row({ status: "in_progress" }), "2026-06-23"),
    "in_consultation"
  );
});

test("buildConsultationAttentionPriorities surfaces preparation for today's drafts", () => {
  const items = buildConsultationAttentionPriorities(
    "/fi-admin/t",
    emptyPayload({ consultations: [row(), row({ id: "c-2" })] }),
    5
  );
  assert.ok(items.some((i) => i.id === "preparation_today"));
  assert.equal(hasUrgentConsultationAttention(items), true);
});

test("buildClinicalPlanningQueueItems flags missing assessment", () => {
  const items = buildClinicalPlanningQueueItems(
    "/fi-admin/t",
    emptyPayload({ consultations: [row({ status: "in_progress" })] }),
    5
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].planningLabel, "Hair loss classification incomplete");
});
