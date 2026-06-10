import assert from "node:assert/strict";
import { test } from "node:test";

import type { CaseWorklistRow } from "@/src/lib/cases/casesIndexTypes";
import {
  addCalendarDaysToYmd,
  dashboardTodayYmd,
  deriveSurgeryOsDashboardModel,
  hasDueFollowUp,
  isRecentlyCompletedProcedure,
  isTodaySurgeryRow,
  isUpcomingSurgeryWindowRow,
} from "@/src/lib/cases/surgeryOsDashboardDerive";

function stubRow(partial: Partial<CaseWorklistRow> & Pick<CaseWorklistRow, "id" | "person_label">): CaseWorklistRow {
  const now = "2026-06-01T12:00:00.000Z";
  return {
    id: partial.id,
    status: partial.status ?? "consultation",
    treatment_type: partial.treatment_type ?? "FUE",
    case_type: partial.case_type ?? null,
    external_id: partial.external_id ?? null,
    foundation_patient_id: partial.foundation_patient_id ?? "p1",
    legacy_patient_id: partial.legacy_patient_id ?? null,
    person_label: partial.person_label,
    person_email: partial.person_email ?? null,
    lead: partial.lead ?? null,
    created_at: partial.created_at ?? now,
    updated_at: partial.updated_at ?? now,
    tenant_id: partial.tenant_id ?? "t1",
    imageCount: partial.imageCount ?? 0,
    bookingCount: partial.bookingCount ?? 0,
    surgeryPlan: partial.surgeryPlan ?? null,
    procedureDay: partial.procedureDay ?? null,
    postOpTracking: partial.postOpTracking ?? null,
    followUps: partial.followUps ?? [],
    readinessPercent: partial.readinessPercent ?? 50,
    readinessBucket: partial.readinessBucket ?? "in_progress",
    readinessNeedsAttention: partial.readinessNeedsAttention ?? false,
    procedureDate: partial.procedureDate ?? null,
    readinessCaseProfileHealth: partial.readinessCaseProfileHealth ?? "complete",
    readinessSurgeryPlanningHealth: partial.readinessSurgeryPlanningHealth ?? "not_started",
    readinessProcedureDayHealth: partial.readinessProcedureDayHealth ?? "not_started",
    readinessPostOpHealth: partial.readinessPostOpHealth ?? "not_started",
    readinessFollowUpsHealth: partial.readinessFollowUpsHealth ?? "not_started",
  };
}

test("dashboardTodayYmd matches fixed local date", () => {
  const ymd = dashboardTodayYmd(new Date(2026, 5, 8, 9, 0, 0));
  assert.equal(ymd, "2026-06-08");
});

test("addCalendarDaysToYmd advances calendar correctly", () => {
  assert.equal(addCalendarDaysToYmd("2026-06-08", 1), "2026-06-09");
  assert.equal(addCalendarDaysToYmd("2026-06-08", 30), "2026-07-08");
});

test("isTodaySurgeryRow respects procedure date and terminal statuses", () => {
  const today = "2026-06-08";
  const ok = stubRow({
    id: "a",
    person_label: "A",
    procedureDate: today,
    procedureDay: {
      id: "p",
      tenant_id: "t1",
      case_id: "a",
      procedure_date: today,
      procedure_status: "scheduled",
      surgeon_user_id: null,
      nurse_user_id: null,
      technician_user_ids: [],
      team_member_user_ids: [],
      procedure_milestones: {},
      procedure_location: null,
      procedure_room: null,
      start_time: null,
      finish_time: null,
      punch_size: null,
      extraction_method: null,
      implantation_method: null,
      medication_notes: null,
      intraoperative_notes: null,
      grafts_extracted: null,
      grafts_implanted: null,
      hairs_implanted: null,
      graft_handling_notes: null,
      complications_notes: null,
      completion_summary: null,
      created_at: "",
      updated_at: "",
    },
  });
  assert.equal(isTodaySurgeryRow(ok, today), true);

  const cancelled = stubRow({
    ...ok,
    id: "b",
    person_label: "B",
    procedureDay: ok.procedureDay ? { ...ok.procedureDay, id: "p2", case_id: "b", procedure_status: "cancelled" } : null,
  });
  assert.equal(isTodaySurgeryRow(cancelled, today), false);
});

test("isUpcomingSurgeryWindowRow excludes today and completed", () => {
  const today = "2026-06-08";
  const end = "2026-07-08";
  const proc = (date: string, status: string) =>
    stubRow({
      id: date,
      person_label: date,
      procedureDate: date,
      procedureDay: {
        id: "p",
        tenant_id: "t1",
        case_id: date,
        procedure_date: date,
        procedure_status: status,
        surgeon_user_id: null,
        nurse_user_id: null,
        technician_user_ids: [],
        team_member_user_ids: [],
        procedure_milestones: {},
        procedure_location: null,
        procedure_room: null,
        start_time: null,
        finish_time: null,
        punch_size: null,
        extraction_method: null,
        implantation_method: null,
        medication_notes: null,
        intraoperative_notes: null,
        grafts_extracted: null,
        grafts_implanted: null,
        hairs_implanted: null,
        graft_handling_notes: null,
        complications_notes: null,
        completion_summary: null,
        created_at: "",
        updated_at: "",
      },
    });

  assert.equal(isUpcomingSurgeryWindowRow(proc(today, "scheduled"), today, end), false);
  assert.equal(isUpcomingSurgeryWindowRow(proc("2026-06-09", "scheduled"), today, end), true);
  assert.equal(isUpcomingSurgeryWindowRow(proc("2026-06-09", "completed"), today, end), false);
});

test("hasDueFollowUp detects scheduled date on/before today", () => {
  const row = stubRow({
    id: "c",
    person_label: "C",
    followUps: [
      {
        id: "fu1",
        tenant_id: "t1",
        case_id: "c",
        checkpoint: "day_1",
        scheduled_date: "2026-06-07",
        completed_date: null,
        follow_up_status: "scheduled",
        notes: null,
        linked_image_ids: [],
        created_at: "",
        updated_at: "",
      },
    ],
  });
  assert.equal(hasDueFollowUp(row, "2026-06-08"), true);
  assert.equal(hasDueFollowUp(row, "2026-06-06"), false);
});

test("isRecentlyCompletedProcedure is within 14-day lookback", () => {
  const row = stubRow({
    id: "d",
    person_label: "D",
    procedureDate: "2026-06-07",
    procedureDay: {
      id: "p",
      tenant_id: "t1",
      case_id: "d",
      procedure_date: "2026-06-07",
      procedure_status: "completed",
      surgeon_user_id: null,
      nurse_user_id: null,
      technician_user_ids: [],
      team_member_user_ids: [],
      procedure_milestones: {},
      procedure_location: null,
      procedure_room: null,
      start_time: null,
      finish_time: null,
      punch_size: null,
      extraction_method: null,
      implantation_method: null,
      medication_notes: null,
      intraoperative_notes: null,
      grafts_extracted: 1,
      grafts_implanted: 1,
      hairs_implanted: null,
      graft_handling_notes: null,
      complications_notes: null,
      completion_summary: null,
      created_at: "",
      updated_at: "",
    },
  });
  assert.equal(isRecentlyCompletedProcedure(row, "2026-06-08"), true);
  assert.equal(isRecentlyCompletedProcedure(row, "2026-07-01"), false);
});

test("deriveSurgeryOsDashboardModel aggregates active cases", () => {
  const fixed = new Date(2026, 5, 8, 12, 0, 0);
  const rows: CaseWorklistRow[] = [
    stubRow({ id: "1", person_label: "Active", status: "consultation" }),
    stubRow({ id: "2", person_label: "Done", status: "complete" }),
  ];
  const m = deriveSurgeryOsDashboardModel(rows, fixed);
  assert.equal(m.metrics.totalActiveCases, 1);
  assert.equal(m.todayYmd, "2026-06-08");
});
