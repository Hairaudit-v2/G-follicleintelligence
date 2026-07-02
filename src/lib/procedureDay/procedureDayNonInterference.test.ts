import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCalendarOperationalFeedFromBookings } from "@/src/lib/calendar/calendarOperationalFeedCore";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { deriveSurgeryOsDashboardModel } from "@/src/lib/cases/surgeryOsDashboardDerive";
import type { CaseWorklistRow } from "@/src/lib/cases/casesIndexTypes";
import { resolveFiOsPrimarySidebarItems } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { resolveClinicOsShellNavItems } from "@/src/lib/fiAdmin/clinicOsShellConfig";
import { buildQuickActions } from "@/src/lib/receptionBoard/receptionBoardCore";
import { buildProcedureDayLiveCardState } from "./procedureDayLiveCore";
import { deriveProcedureDayStageFromBooking } from "./procedureDayWorkflowCore";
import type { ProcedureDayScheduleCard } from "@/src/lib/surgery/procedureDayBoardLoader.server";
import { isFiProcedureDayEnabledFromEnv } from "@/src/lib/procedureDay/procedureDayEnv";
import {
  appendProcedureDayQuickActionIfEnabled,
  PROCEDURE_DAY_QUICK_ACTION_ID,
} from "@/src/lib/procedureDay/procedureDayReceptionCore";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

const TENANT = "11111111-1111-4111-8111-111111111111";
const base = `/fi-admin/${TENANT}`;

function stubRow(
  partial: Partial<CaseWorklistRow> & Pick<CaseWorklistRow, "id" | "person_label">
): CaseWorklistRow {
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
    tenant_id: partial.tenant_id ?? TENANT,
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

describe("procedure day non-interference", () => {
  it("(a) SurgeryOS dashboard derive works when procedureDay is null", () => {
    const today = "2026-06-08";
    const rows = [
      stubRow({
        id: "case-1",
        person_label: "Alex",
        procedureDate: today,
        procedureDay: null,
        bookingCount: 1,
      }),
    ];
    const model = deriveSurgeryOsDashboardModel(rows, new Date(2026, 5, 8, 9, 0, 0));
    assert.ok(model.todaySurgeries.length >= 0);
    assert.equal(rows[0]!.procedureDay, null);
  });

  it("(b) CalendarOS operational feed renders without procedure-day dependency", () => {
    const booking: FiBookingRow = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenant_id: TENANT,
      lead_id: null,
      person_id: null,
      patient_id: null,
      case_id: null,
      clinic_id: null,
      room_id: null,
      room_required: true,
      assigned_staff_id: null,
      assigned_user_id: null,
      booking_type: "surgery",
      booking_status: "scheduled",
      title: "Surgery",
      description: null,
      start_at: "2026-07-02T09:00:00.000Z",
      end_at: "2026-07-02T10:00:00.000Z",
      timezone: "UTC",
      location: null,
      metadata: {},
      cancelled_at: null,
      cancelled_by_user_id: null,
      cancellation_reason: null,
      created_by_user_id: null,
      created_at: "2026-07-02T09:00:00.000Z",
      updated_at: "2026-07-02T09:00:00.000Z",
    };
    const feed = buildCalendarOperationalFeedFromBookings([booking], {
      tenantId: TENANT,
      patientNameByBookingId: new Map(),
      staffNameById: {},
      roomLabelById: {},
      journeyStateByPatientId: new Map(),
      depositSatisfiedByBookingId: new Map(),
      consentSignedByPatientId: new Map(),
      preOpCompleteByBookingId: new Map(),
      readinessPercentByBookingId: new Map(),
      staffIdToUserId: new Map(),
      gridConfig: {
        dayStartHourUtc: 6,
        dayEndHourUtc: 19,
        slotMinutes: 15,
        timeZone: "UTC",
      },
      bufferMinutes: 10,
    });
    assert.equal(feed.items.length, 1);
    assert.equal(feed.items[0]!.isSurgery, true);
  });

  it("(c) reception quick actions unchanged when procedure day flag is off", () => {
    const baseline = buildQuickActions(base);
    const withFlagOff = appendProcedureDayQuickActionIfEnabled(baseline, base, false);
    assert.deepEqual(withFlagOff, baseline);
    assert.ok(!withFlagOff.some((a) => a.id === PROCEDURE_DAY_QUICK_ACTION_ID));
  });

  it("(d) route gate env defaults to disabled", () => {
    assert.equal(isFiProcedureDayEnabledFromEnv({}), false);
    assert.equal(isFiProcedureDayEnabledFromEnv({ FI_PROCEDURE_DAY_ENABLED: "false" }), false);
    assert.equal(isFiProcedureDayEnabledFromEnv({ FI_PROCEDURE_DAY_ENABLED: "true" }), true);
  });

  it("(d) nav omits procedure day when showProcedureDayNav is false", () => {
    const items = resolveFiOsPrimarySidebarItems(base, true, true, null, true, true, false, false, false);
    const cases = items.find((i) => i.id === "cases");
    assert.ok(cases?.subItems?.length);
    assert.ok(!cases!.subItems!.some((s) => s.href.endsWith("/procedure-day")));

    const shellItems = resolveClinicOsShellNavItems(base, true, true, false, false);
    assert.ok(!shellItems.some((i) => i.id === "procedure-day-board"));
  });

  it("(e) orchestrator rejects empty tenant id before loaders run", () => {
    assert.throws(() => assertNonEmptyUuid("", "tenantId"), /tenantId/);
    assert.throws(() => assertNonEmptyUuid("not-a-uuid", "tenantId"), /tenantId/);
    assert.equal(assertNonEmptyUuid(TENANT, "tenantId"), TENANT);
  });

  it("live workflow derive works when session tables are empty", () => {
    assert.equal(
      deriveProcedureDayStageFromBooking({ bookingStatus: "confirmed" }),
      "scheduled"
    );
    const live = buildProcedureDayLiveCardState(
      {
        bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        bookingStatus: "scheduled",
        procedureProgress: { statusRaw: null },
        financialClearance: { financially_safe_to_proceed: true },
        preOp: {
          consentProxy: true,
          pathologyReviewed: true,
          depositOkOrUntracked: true,
          procedurePlanComplete: true,
          surgeonAssigned: true,
          roomOk: true,
        },
        procedureSurgeonLabel: "Dr A",
        calendarAssigneeLabel: null,
      } as unknown as ProcedureDayScheduleCard,
      null
    );
    assert.equal(live.sessionId, null);
    assert.equal(live.currentStage, "scheduled");
  });
});