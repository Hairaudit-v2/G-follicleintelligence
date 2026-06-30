import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateConsultationConversionKpis,
  hasQuoteDraftSignals,
  isCrmLostSignal,
  normalizeQuoteStatusFromSignals,
  pickConsultationConversionColumn,
} from "@/src/lib/consultations/consultationConversionBoardModel";

test("booking without consultation row → Consultation booked", () => {
  assert.equal(
    pickConsultationConversionColumn({
      crmLost: false,
      consultationArchived: false,
      surgeryBooked: false,
      quoteNormalized: "neutral",
      quoteDraftContent: false,
      consultationStatus: "draft",
      isBookingOnly: true,
      bookingCompletedOrPast: false,
    }),
    "consultation_booked"
  );
});

test("completed consultation without quote → Consultation completed", () => {
  assert.equal(
    pickConsultationConversionColumn({
      crmLost: false,
      consultationArchived: false,
      surgeryBooked: false,
      quoteNormalized: "neutral",
      quoteDraftContent: false,
      consultationStatus: "completed",
      isBookingOnly: false,
      bookingCompletedOrPast: true,
    }),
    "consultation_completed"
  );
});

test("quote_sent maps to Quote sent", () => {
  assert.equal(
    normalizeQuoteStatusFromSignals({
      consultationStatus: "completed",
      quoteStatusRaw: "quote_sent",
    }),
    "sent"
  );
  assert.equal(
    pickConsultationConversionColumn({
      crmLost: false,
      consultationArchived: false,
      surgeryBooked: false,
      quoteNormalized: "sent",
      quoteDraftContent: false,
      consultationStatus: "completed",
      isBookingOnly: false,
      bookingCompletedOrPast: true,
    }),
    "quote_sent"
  );
});

test("quote_accepted maps to Quote accepted", () => {
  assert.equal(
    normalizeQuoteStatusFromSignals({
      consultationStatus: "completed",
      quoteStatusRaw: "quote_accepted",
    }),
    "accepted"
  );
  assert.equal(
    pickConsultationConversionColumn({
      crmLost: false,
      consultationArchived: false,
      surgeryBooked: false,
      quoteNormalized: "accepted",
      quoteDraftContent: false,
      consultationStatus: "accepted",
      isBookingOnly: false,
      bookingCompletedOrPast: true,
    }),
    "quote_accepted"
  );
});

test("linked case or surgery booking maps to Surgery booked", () => {
  assert.equal(
    pickConsultationConversionColumn({
      crmLost: false,
      consultationArchived: false,
      surgeryBooked: true,
      quoteNormalized: "sent",
      quoteDraftContent: false,
      consultationStatus: "quoted",
      isBookingOnly: false,
      bookingCompletedOrPast: true,
    }),
    "surgery_booked"
  );
});

test("lost CRM stage maps to Lost / not proceeding", () => {
  assert.ok(isCrmLostSignal({ stageIsLost: true, leadStatusLost: false }));
  assert.equal(
    pickConsultationConversionColumn({
      crmLost: true,
      consultationArchived: false,
      surgeryBooked: true,
      quoteNormalized: "accepted",
      quoteDraftContent: false,
      consultationStatus: "accepted",
      isBookingOnly: false,
      bookingCompletedOrPast: true,
    }),
    "lost"
  );
});

test("payment/deposit not connected: KPI layer has no payment fields (neutral)", () => {
  const k = aggregateConsultationConversionKpis({
    calendarTimezone: "UTC",
    consultationBookingStartsNext30: [],
    todayYmd: "2026-06-10",
    completedConsultationDatesLast30: [],
    columnCounts: {
      consultation_booked: 0,
      consultation_completed: 2,
      quote_drafted: 0,
      quote_sent: 1,
      quote_accepted: 1,
      surgery_booked: 1,
      lost: 0,
    },
  });
  assert.equal(typeof k.consultationsBookedNext30Days, "number");
  assert.ok(!("deposit" in k) && !("payment" in k));
});

test("hasQuoteDraftSignals detects graft_estimate text", () => {
  assert.ok(hasQuoteDraftSignals({ graft_estimate: "2200" }));
});
