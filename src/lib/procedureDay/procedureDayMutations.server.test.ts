import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { buildProcedureDayLiveCardState } from "./procedureDayLiveCore";
import type { ProcedureDayScheduleCard } from "@/src/lib/surgery/procedureDayBoardLoader.server";

const stubCard = {
  bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  startAt: "2026-07-02T09:00:00.000Z",
  timeLabel: "09:00",
  patientLabel: "Alex Patient",
  caseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  caseLabel: "FUE",
  procedureType: "FUE",
  graftTargetLabel: "2000",
  calendarAssigneeLabel: "Dr Smith",
  procedureSurgeonLabel: "Dr Smith",
  procedureNurseLabel: null,
  procedureTechnicianLabels: [],
  teamMemberLabels: [],
  roomLabel: "Theatre 1",
  procedureRoomText: null,
  bookingStatus: "scheduled",
  bookingStatusLabel: "Scheduled",
  bookingTypeLabel: "Surgery",
  readinessPercent: 90,
  readinessBucketLabel: "Ready",
  readinessBucket: "ready",
  surgeryDepositBadge: null,
  financialPipeline: "cleared",
  financialClearance: {
    clearance_state: "cleared",
    clearance_label: "Cleared",
    clearance_reason: "",
    blocking_factors: [],
    warning_factors: [],
    amount_paid_cents: 0,
    balance_due_cents: 0,
    next_required_action: null,
    financially_safe_to_proceed: true,
    paid_in_full: true,
  },
  issues: [],
  preOp: {
    caseLinked: true,
    consentProxy: true,
    pathologyReviewed: true,
    depositOkOrUntracked: true,
    procedurePlanComplete: true,
    surgeonAssigned: true,
    roomOk: true,
  },
  procedureProgress: {
    rowExists: false,
    statusRaw: null,
    statusLabel: null,
    startTime: null,
    finishTime: null,
    extractionImplantSummary: null,
  },
  pipelinePhase: "scheduled",
  hrefs: {
    appointment: "/fi-admin/t/bookings/b",
    case: "/fi-admin/t/cases/c",
    patient: "/fi-admin/t/patients/p",
    calendar: "/fi-admin/t/calendar",
  },
  clinicalStaffing: null,
} as unknown as ProcedureDayScheduleCard;

describe("procedureDayMutations.server", () => {
  it("live card derives scheduled state without session row", () => {
    const live = buildProcedureDayLiveCardState(stubCard, null);
    assert.equal(live.currentStage, "scheduled");
    assert.equal(live.sessionId, null);
    assert.equal(live.canStart, true);
    assert.equal(live.isLive, false);
  });

  it("live card reflects active session stage and metrics", () => {
    const live = buildProcedureDayLiveCardState(stubCard, {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      bookingId: stubCard.bookingId,
      patientId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      caseId: stubCard.caseId,
      currentStage: "extraction",
      startedAt: "2026-07-02T09:05:00.000Z",
      completedAt: null,
      metadata: { graftsExtracted: 120 },
      createdAt: "2026-07-02T09:05:00.000Z",
      updatedAt: "2026-07-02T09:05:00.000Z",
    });
    assert.equal(live.currentStage, "extraction");
    assert.equal(live.isLive, true);
    assert.equal(live.metrics.graftsExtracted, 120);
    assert.equal(live.nextStage, "graft_counting");
  });

  it("tenant isolation rejects invalid booking id at validation layer", () => {
    assert.throws(() => assertNonEmptyUuid("not-a-uuid", "bookingId"), /bookingId/);
  });
});