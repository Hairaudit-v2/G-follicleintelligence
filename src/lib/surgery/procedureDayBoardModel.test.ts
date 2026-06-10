import assert from "node:assert/strict";
import test from "node:test";

import {
  accumulateProcedureProgressCounts,
  buildProcedureDayActionItems,
  computeProcedureDayBoardWindow,
  deriveSurgeryDayPipelinePhase,
  emptyProcedureDayProgressCounts,
  isBookingStartOnTenantLocalDay,
  procedureProgressBucket,
  summarizeProcedureDayBoard,
} from "@/src/lib/surgery/procedureDayBoardModel";

const baseAction = {
  tenantId: "a0000000-0000-4000-8000-0000000000e1",
  bookingId: "b1111111-1111-4111-8111-111111111111",
  patientLabel: "Test Patient",
  todayYmd: "2026-06-10",
};

test("isBookingStartOnTenantLocalDay: filters by tenant calendar day", () => {
  const tz = "Australia/Brisbane";
  const ymd = "2026-06-10";
  const ok = isBookingStartOnTenantLocalDay("2026-06-09T14:00:00.000Z", tz, ymd);
  const no = isBookingStartOnTenantLocalDay("2026-06-08T14:00:00.000Z", tz, ymd);
  assert.equal(ok, true);
  assert.equal(no, false);
});

test("computeProcedureDayBoardWindow: range covers single tenant day", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const w = computeProcedureDayBoardWindow(now, "UTC");
  assert.equal(w.todayYmd, "2026-06-10");
  assert.ok(w.rangeStartIso < w.rangeEndIso);
});

test("procedureProgressBucket: maps lifecycle to aggregate buckets", () => {
  assert.equal(procedureProgressBucket("scheduled"), "scheduled");
  assert.equal(procedureProgressBucket("checked_in"), "in_progress");
  assert.equal(procedureProgressBucket("in_progress"), "in_progress");
  assert.equal(procedureProgressBucket("paused"), "in_progress");
  assert.equal(procedureProgressBucket("completed"), "completed");
  assert.equal(procedureProgressBucket("cancelled"), "cancelled");
  assert.equal(procedureProgressBucket("aborted"), "cancelled");
  assert.equal(procedureProgressBucket(null), null);
});

test("deriveSurgeryDayPipelinePhase: booking completed wins", () => {
  assert.equal(
    deriveSurgeryDayPipelinePhase({
      bookingStatus: "completed",
      procedureStatus: "in_progress",
      readinessBucket: "needs_attention",
    }),
    "completed"
  );
});

test("deriveSurgeryDayPipelinePhase: arrived booking is in progress", () => {
  assert.equal(
    deriveSurgeryDayPipelinePhase({
      bookingStatus: "arrived",
      procedureStatus: "scheduled",
      readinessBucket: "ready",
    }),
    "in_progress"
  );
});

test("summarizeProcedureDayBoard: counts phases and flags", () => {
  const s = summarizeProcedureDayBoard(
    ["ready", "in_progress", "completed", "scheduled"],
    [
      { highRisk: true, unassignedTeam: false, missingRoom: false },
      { highRisk: false, unassignedTeam: true, missingRoom: true },
    ]
  );
  assert.equal(s.surgeriesToday, 4);
  assert.equal(s.ready, 1);
  assert.equal(s.inProgress, 1);
  assert.equal(s.completed, 1);
  assert.equal(s.highRiskReadinessIssues, 1);
  assert.equal(s.unassignedSurgeonOrTeam, 1);
  assert.equal(s.missingRoom, 1);
});

test("accumulateProcedureProgressCounts: buckets procedure rows", () => {
  const acc = emptyProcedureDayProgressCounts();
  accumulateProcedureProgressCounts(acc, "scheduled", true);
  accumulateProcedureProgressCounts(acc, "in_progress", true);
  accumulateProcedureProgressCounts(acc, "completed", true);
  accumulateProcedureProgressCounts(acc, "cancelled", true);
  accumulateProcedureProgressCounts(acc, "scheduled", false);
  assert.deepEqual(acc, { scheduled: 1, inProgress: 1, completed: 1, cancelled: 1 });
});

test("buildProcedureDayActionItems: missing case creates link action only", () => {
  const items = buildProcedureDayActionItems({
    ...baseAction,
    caseId: null,
    bookingStatus: "confirmed",
    abnormalPathologyCount: 0,
    hasBookingAssignee: false,
    hasProcedureSurgeon: false,
    roomRequired: true,
    hasRoom: false,
    procedureRowExists: false,
    procedureStatus: null,
    surgeryPaymentRecord: null,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "link_missing_case");
});

test("buildProcedureDayActionItems: abnormal pathology creates review action", () => {
  const items = buildProcedureDayActionItems({
    ...baseAction,
    caseId: "c2222222-2222-4222-8222-222222222222",
    bookingStatus: "arrived",
    abnormalPathologyCount: 2,
    hasBookingAssignee: true,
    hasProcedureSurgeon: true,
    roomRequired: false,
    hasRoom: false,
    procedureRowExists: true,
    procedureStatus: "in_progress",
    surgeryPaymentRecord: null,
  });
  assert.ok(items.some((i) => i.kind === "review_abnormal_pathology"));
});

test("buildProcedureDayActionItems: missing room only when room required", () => {
  const off = buildProcedureDayActionItems({
    ...baseAction,
    caseId: "c2222222-2222-4222-8222-222222222222",
    bookingStatus: "confirmed",
    abnormalPathologyCount: 0,
    hasBookingAssignee: true,
    hasProcedureSurgeon: true,
    roomRequired: false,
    hasRoom: false,
    procedureRowExists: true,
    procedureStatus: "scheduled",
    surgeryPaymentRecord: null,
  });
  assert.equal(
    off.some((i) => i.kind === "assign_room"),
    false
  );

  const on = buildProcedureDayActionItems({
    ...baseAction,
    caseId: "c2222222-2222-4222-8222-222222222222",
    bookingStatus: "confirmed",
    abnormalPathologyCount: 0,
    hasBookingAssignee: true,
    hasProcedureSurgeon: true,
    roomRequired: true,
    hasRoom: false,
    procedureRowExists: true,
    procedureStatus: "scheduled",
    surgeryPaymentRecord: null,
  });
  assert.ok(on.some((i) => i.kind === "assign_room"));
});

test("buildProcedureDayActionItems: pending deposit shows payment warning when tracked", () => {
  const items = buildProcedureDayActionItems({
    ...baseAction,
    caseId: "c2222222-2222-4222-8222-222222222222",
    bookingStatus: "confirmed",
    abnormalPathologyCount: 0,
    hasBookingAssignee: true,
    hasProcedureSurgeon: true,
    roomRequired: false,
    hasRoom: true,
    procedureRowExists: true,
    procedureStatus: "scheduled",
    surgeryPaymentRecord: {
      status: "pending",
      due_date: "2026-01-01",
      amount_expected: 500,
      amount_paid: 0,
    },
  });
  assert.ok(items.some((i) => i.kind === "surgery_deposit_pending"));
});

test("buildProcedureDayActionItems: no payment record stays neutral (no deposit action)", () => {
  const items = buildProcedureDayActionItems({
    ...baseAction,
    caseId: "c2222222-2222-4222-8222-222222222222",
    bookingStatus: "confirmed",
    abnormalPathologyCount: 0,
    hasBookingAssignee: true,
    hasProcedureSurgeon: true,
    roomRequired: false,
    hasRoom: true,
    procedureRowExists: true,
    procedureStatus: "scheduled",
    surgeryPaymentRecord: null,
  });
  assert.equal(
    items.some((i) => i.kind === "surgery_deposit_pending"),
    false
  );
});

test("buildProcedureDayActionItems: missing surgeon and calendar assignee", () => {
  const items = buildProcedureDayActionItems({
    ...baseAction,
    caseId: "c2222222-2222-4222-8222-222222222222",
    bookingStatus: "confirmed",
    abnormalPathologyCount: 0,
    hasBookingAssignee: false,
    hasProcedureSurgeon: false,
    roomRequired: false,
    hasRoom: true,
    procedureRowExists: true,
    procedureStatus: "scheduled",
    surgeryPaymentRecord: null,
  });
  assert.ok(items.some((i) => i.kind === "assign_surgeon_team"));
});
