import assert from "node:assert/strict";
import { test } from "node:test";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  buildRosterFullDayAbsenceLocalWindow,
  buildRosterShiftDrawerDefaults,
  buildRosterShiftFormValuesFromShift,
  closeRosterDrawer,
  buildRosterPeriodAbsenceLocalWindow,
  collectCancellableRosterDayShifts,
  collectCancellableStaffShiftsInPeriod,
  formatRosterShiftDrawerTitle,
  formatStandardHoursDrawerTitle,
  listStaffMissingStandardHours,
  normaliseDatetimeLocalHm,
  openRosterMissingStandardHoursSetupDrawer,
  openRosterShiftDrawer,
  openRosterStandardHoursDrawer,
  resolveRosterManageDeniedMessage,
  resolveRosterShiftDrawerChangedFields,
  resolveRosterShiftDrawerEditEligibility,
  rosterDayAwayReasonLabel,
  rosterDayAwayShiftCancellationReason,
  rosterShiftDrawerEditRequiresReason,
  toRosterShiftDatetimeLocal,
  resolveRosterCellClickIntent,
  resolveRosterDrawerStaffContext,
  resolveRosterDrawerStaffMemberId,
  resolveRosterDrawerStaffName,
  resolveRosterPayloadWeekDayDates,
  rosterAvailabilityLocalDateFromIso,
  rosterShiftDatetimeLocalToUtcIso,
  ROSTER_SHIFT_INVALID_TIME_RANGE_MESSAGE,
  ROSTER_SHIFT_START_END_REQUIRED_MESSAGE,
  shiftMatchesRosterCellDate,
  ROSTER_GRID_SCROLL_CLASSES,
  ROSTER_PAGE_SCROLL_ROOT_CLASSES,
} from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import { ROSTER_MANAGE_DENIED_REASON } from "@/src/lib/workforce-os/staffStandardHoursRoutes";
import {
  applyStandardHoursTemplate,
  formatStandardHoursSummary,
  formatStandardHoursWeeklyTotal,
  staffHasConfiguredStandardHours,
} from "@/src/lib/workforce-os/staffStandardHoursCore";

const STAFF_PAUL = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const STAFF_JANE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

test("roster page scroll contract allows vertical growth without clipping", () => {
  assert.ok(
    ROSTER_PAGE_SCROLL_ROOT_CLASSES.includes("shrink-0"),
    "roster page root must grow main scroll height"
  );
  assert.ok(
    !ROSTER_PAGE_SCROLL_ROOT_CLASSES.includes("overflow-hidden"),
    "roster page root must not clip vertically"
  );
  assert.ok(
    ROSTER_GRID_SCROLL_CLASSES.includes("overflow-x-auto"),
    "roster grid must scroll horizontally"
  );
  assert.ok(
    !fiOsChromeClasses.tenantMainSurfaceScroll.includes("overflow-hidden"),
    "tenant main surface scroll variant must not clip roster"
  );
});

test("staffHasConfiguredStandardHours and summary for four_ten template", () => {
  const days = applyStandardHoursTemplate("four_ten");
  assert.equal(staffHasConfiguredStandardHours(days), true);
  assert.equal(staffHasConfiguredStandardHours(applyStandardHoursTemplate("custom")), false);
  assert.match(formatStandardHoursSummary(days), /4 × 10h/);
  assert.match(formatStandardHoursSummary(days), /Mon Tue Thu Fri/);
  assert.match(formatStandardHoursSummary(days), /07:30–17:30/);
  assert.equal(formatStandardHoursSummary(undefined), "No standard hours set");
});

test("formatStandardHoursWeeklyTotal handles missing staff pattern safely", () => {
  assert.equal(formatStandardHoursWeeklyTotal(undefined), "0.0");
  assert.equal(formatStandardHoursWeeklyTotal([]), "0.0");
  assert.equal(formatStandardHoursWeeklyTotal(applyStandardHoursTemplate("four_ten")), "40.0");
});

test("resolveRosterCellClickIntent opens cell actions for empty cells", () => {
  assert.equal(resolveRosterCellClickIntent({ hasStandardHours: false }), "open_cell_actions");
  assert.equal(resolveRosterCellClickIntent({ hasStandardHours: true }), "open_cell_actions");
});

test("buildRosterShiftDrawerDefaults prefills staff/date/clinic/shift type from standard hours", () => {
  const days = applyStandardHoursTemplate("four_ten");
  days[0] = { ...days[0]!, clinic_id: "clinic-1" };

  const defaults = buildRosterShiftDrawerDefaults({
    staffId: STAFF_PAUL,
    localDate: "2026-07-06",
    staffRole: "reception",
    filterClinicId: "",
    standardHours: days,
  });

  assert.equal(defaults.staffId, STAFF_PAUL);
  assert.equal(defaults.clinicId, "clinic-1");
  assert.equal(defaults.shiftType, "clinic_day");
  assert.equal(defaults.startsAt, "2026-07-06T07:30");
  assert.equal(defaults.endsAt, "2026-07-06T17:30");
});

test("buildRosterShiftDrawerDefaults falls back to staff role and filter clinic", () => {
  const defaults = buildRosterShiftDrawerDefaults({
    staffId: STAFF_PAUL,
    localDate: "2026-07-07",
    staffRole: "surgeon",
    filterClinicId: "clinic-filter",
    standardHours: undefined,
  });

  assert.equal(defaults.clinicId, "clinic-filter");
  assert.equal(defaults.shiftType, "surgery_day");
  assert.equal(defaults.startsAt, "2026-07-07T09:00");
});

test("normaliseDatetimeLocalHm coerces DB time formats for datetime-local inputs", () => {
  assert.equal(normaliseDatetimeLocalHm("8:30"), "08:30");
  assert.equal(normaliseDatetimeLocalHm("08:30:00"), "08:30");
  assert.equal(normaliseDatetimeLocalHm("17:00:00.000"), "17:00");
  assert.equal(normaliseDatetimeLocalHm("bad", "09:00"), "09:00");
});

test("buildRosterFullDayAbsenceLocalWindow spans local calendar day for leave blocks", () => {
  assert.deepEqual(buildRosterFullDayAbsenceLocalWindow("2026-07-10"), {
    startsAtLocal: "2026-07-10T00:00",
    endsAtLocal: "2026-07-10T23:59",
  });
});

test("resolveRosterManageDeniedMessage never returns a blank deny string", () => {
  assert.equal(resolveRosterManageDeniedMessage(""), ROSTER_MANAGE_DENIED_REASON);
  assert.equal(resolveRosterManageDeniedMessage(null), ROSTER_MANAGE_DENIED_REASON);
  assert.equal(resolveRosterManageDeniedMessage("  Custom deny  "), "Custom deny");
});

test("collectCancellableRosterDayShifts unions day list and selected shift without duplicates", () => {
  const day = [
    { id: "a", status: "scheduled" },
    { id: "b", status: "cancelled" },
    { id: "c", status: "confirmed" },
  ];
  assert.deepEqual(
    collectCancellableRosterDayShifts({
      dayShifts: day,
      selectedShift: { id: "a", status: "scheduled" },
    }).map((s) => s.id),
    ["a", "c"]
  );
  assert.deepEqual(
    collectCancellableRosterDayShifts({
      dayShifts: [],
      selectedShift: { id: "z", status: "scheduled" },
    }).map((s) => s.id),
    ["z"]
  );
});

test("roster day-away helpers map leave kinds to labels and cancel reasons", () => {
  assert.equal(rosterDayAwayReasonLabel("sick_leave"), "Sick leave");
  assert.equal(rosterDayAwayShiftCancellationReason("sick_leave"), "staff_sick");
  assert.equal(rosterDayAwayShiftCancellationReason("leave"), "manual_adjustment");
});

test("buildRosterPeriodAbsenceLocalWindow spans first to last local date", () => {
  assert.deepEqual(
    buildRosterPeriodAbsenceLocalWindow(["2026-07-08", "2026-07-06", "2026-07-10"]),
    {
      startsAtLocal: "2026-07-06T00:00",
      endsAtLocal: "2026-07-10T23:59",
    }
  );
  assert.equal(buildRosterPeriodAbsenceLocalWindow([]), null);
});

test("collectCancellableStaffShiftsInPeriod filters by staff, status, and local dates", () => {
  const staffA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const staffB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const rows = collectCancellableStaffShiftsInPeriod({
    staffId: staffA,
    localDates: ["2026-07-06", "2026-07-07"],
    shifts: [
      {
        id: "1",
        staff_id: staffA,
        status: "scheduled",
        starts_at: "2026-07-05T23:00:00.000Z",
        localDate: "2026-07-06",
      },
      {
        id: "2",
        staff_id: staffA,
        status: "cancelled",
        starts_at: "2026-07-06T23:00:00.000Z",
        localDate: "2026-07-07",
      },
      {
        id: "3",
        staff_id: staffB,
        status: "scheduled",
        starts_at: "2026-07-06T01:00:00.000Z",
        localDate: "2026-07-06",
      },
      {
        id: "4",
        staff_id: staffA,
        status: "confirmed",
        starts_at: "2026-07-07T01:00:00.000Z",
        localDate: "2026-07-07",
      },
      {
        id: "5",
        staff_id: staffA,
        status: "scheduled",
        starts_at: "2026-07-08T01:00:00.000Z",
        localDate: "2026-07-08",
      },
    ],
  });
  assert.deepEqual(rows.map((r) => r.id).sort(), ["1", "4"]);
});

test("buildRosterShiftDrawerDefaults normalises second-precision standard hours times", () => {
  const defaults = buildRosterShiftDrawerDefaults({
    staffId: STAFF_PAUL,
    localDate: "2026-07-06",
    staffRole: "reception",
    filterClinicId: "",
    standardHours: [
      {
        weekday: 0,
        cycle_week: 1,
        is_working_day: true,
        start_time: "08:30:00",
        end_time: "17:00:00",
        break_minutes: 30,
        role_code: "reception",
        clinic_id: null,
      },
    ],
  });
  assert.equal(defaults.startsAt, "2026-07-06T08:30");
  assert.equal(defaults.endsAt, "2026-07-06T17:00");
});

test("drawer titles include staff and date context", () => {
  assert.equal(formatStandardHoursDrawerTitle("Paul Green"), "Paul Green — Standard hours");
  assert.match(
    formatRosterShiftDrawerTitle({
      mode: "add",
      staffName: "Paul Green",
      localDate: "2026-07-07",
    }),
    /^Add shift — Paul Green,/
  );
  assert.match(
    formatRosterShiftDrawerTitle({
      mode: "edit",
      staffName: "Paul Green",
      localDate: "2026-07-07",
    }),
    /^Edit shift — Paul Green,/
  );
});

test("listStaffMissingStandardHours returns only staff without configured hours", () => {
  const fourTen = applyStandardHoursTemplate("four_ten");
  const missing = listStaffMissingStandardHours(
    [
      { id: STAFF_PAUL, name: "Paul Green" },
      { id: STAFF_JANE, name: "Jane Doe" },
    ],
    {
      [STAFF_PAUL]: fourTen,
    }
  );

  assert.equal(missing.length, 1);
  assert.equal(missing[0]?.id, STAFF_JANE);
});

test("resolveRosterPayloadWeekDayDates prefers periodDayDates with weekDayDates fallback", () => {
  assert.deepEqual(
    resolveRosterPayloadWeekDayDates({
      periodDayDates: ["2026-07-06"],
      weekDayDates: ["2026-07-13"],
    }),
    ["2026-07-06"]
  );
  assert.deepEqual(resolveRosterPayloadWeekDayDates({ weekDayDates: ["2026-07-13"] }), [
    "2026-07-13",
  ]);
  assert.deepEqual(resolveRosterPayloadWeekDayDates({}), []);
});

test("roster drawer state helpers open standard-hours and setup panels", () => {
  const standardHoursDrawer = openRosterStandardHoursDrawer(STAFF_JANE);
  assert.deepEqual(standardHoursDrawer, {
    kind: "standard_hours",
    staffMemberId: STAFF_JANE,
  });
  assert.equal(
    resolveRosterDrawerStaffName(standardHoursDrawer, [{ id: STAFF_JANE, name: "Jane Doe" }]),
    "Jane Doe"
  );
  assert.equal(formatStandardHoursDrawerTitle("Jane Doe"), "Jane Doe — Standard hours");

  const setupDrawer = openRosterMissingStandardHoursSetupDrawer();
  assert.deepEqual(setupDrawer, { kind: "setup_missing_standard_hours" });
  assert.equal(resolveRosterDrawerStaffMemberId(setupDrawer), null);

  const shiftDrawer = openRosterShiftDrawer({
    mode: "cell-actions",
    staffMemberId: STAFF_PAUL,
    localDate: "2026-07-07",
    shiftId: null,
  });
  assert.equal(shiftDrawer.kind, "shift");
  assert.equal(resolveRosterDrawerStaffMemberId(shiftDrawer), STAFF_PAUL);
  assert.equal(closeRosterDrawer().kind, "closed");
});

test("resolveRosterDrawerStaffContext resolves grid staff when staffOptions is filtered out", () => {
  const shiftDrawer = openRosterShiftDrawer({
    mode: "cell-actions",
    staffMemberId: STAFF_PAUL,
    localDate: "2026-07-07",
    shiftId: null,
  });

  assert.deepEqual(
    resolveRosterDrawerStaffContext({
      drawer: shiftDrawer,
      staffOptions: [{ id: STAFF_JANE, name: "Jane Doe", role: null }],
      rosterGridStaffOptions: [{ id: STAFF_PAUL, name: "Paul Green", role: "doctor" }],
    }),
    { id: STAFF_PAUL, name: "Paul Green", role: "doctor" }
  );
});

test("buildRosterShiftFormValuesFromShift uses shift data not create defaults", () => {
  const values = buildRosterShiftFormValuesFromShift({
    id: "shift-1",
    staff_id: STAFF_PAUL,
    clinic_id: "clinic-a",
    shift_type: "surgery_day",
    starts_at: "2026-07-06T01:00:00.000Z",
    ends_at: "2026-07-06T09:00:00.000Z",
    status: "scheduled",
    notes: "Existing note",
    shift_source: "manual",
  });

  assert.equal(values.clinicId, "clinic-a");
  assert.equal(values.shiftType, "surgery_day");
  assert.equal(values.notes, "Existing note");
  assert.ok(values.startsAt.includes("T"));
  assert.ok(values.endsAt.includes("T"));
});

test("rosterShiftDrawerEditRequiresReason when time role or clinic changes", () => {
  const original = {
    id: "shift-1",
    staff_id: STAFF_PAUL,
    clinic_id: "clinic-a",
    shift_type: "clinic_day",
    starts_at: "2026-07-06T01:00:00.000Z",
    ends_at: "2026-07-06T09:00:00.000Z",
    status: "scheduled",
    notes: null,
    shift_source: "manual",
  };

  assert.equal(
    rosterShiftDrawerEditRequiresReason(original, {
      clinicId: "clinic-a",
      shiftType: "clinic_day",
      startsAt: toRosterShiftDatetimeLocal("2026-07-06T02:00:00.000Z"),
      endsAt: toRosterShiftDatetimeLocal("2026-07-06T09:00:00.000Z"),
      notes: "",
      startsAtIso: "2026-07-06T02:00:00.000Z",
      endsAtIso: "2026-07-06T09:00:00.000Z",
    }),
    true
  );

  assert.equal(
    rosterShiftDrawerEditRequiresReason(original, {
      clinicId: "clinic-a",
      shiftType: "clinic_day",
      startsAt: toRosterShiftDatetimeLocal(original.starts_at),
      endsAt: toRosterShiftDatetimeLocal(original.ends_at),
      notes: "Updated notes only",
      startsAtIso: original.starts_at,
      endsAtIso: original.ends_at,
    }),
    false
  );

  const changedFields = resolveRosterShiftDrawerChangedFields(original, {
    clinicId: "clinic-a",
    shiftType: "clinic_day",
    startsAt: toRosterShiftDatetimeLocal(original.starts_at),
    endsAt: toRosterShiftDatetimeLocal(original.ends_at),
    notes: "Updated notes only",
    startsAtIso: original.starts_at,
    endsAtIso: original.ends_at,
  });
  assert.deepEqual(changedFields, ["notes"]);
});

test("resolveRosterShiftDrawerEditEligibility hides edit for cancelled shifts", () => {
  const scheduled = resolveRosterShiftDrawerEditEligibility({
    id: "shift-1",
    staff_id: STAFF_PAUL,
    clinic_id: null,
    shift_type: "clinic_day",
    starts_at: "2026-07-06T01:00:00.000Z",
    ends_at: "2026-07-06T09:00:00.000Z",
    status: "scheduled",
    notes: null,
    shift_source: "manual",
  });
  assert.equal(scheduled.canShowEditButton, true);
  assert.equal(scheduled.canCancelShift, true);
  assert.equal(scheduled.openInEditMode, false);

  const generated = resolveRosterShiftDrawerEditEligibility({
    id: "shift-gen",
    staff_id: STAFF_PAUL,
    clinic_id: null,
    shift_type: "clinic_day",
    starts_at: "2026-07-06T01:00:00.000Z",
    ends_at: "2026-07-06T09:00:00.000Z",
    status: "scheduled",
    notes: null,
    shift_source: "standard_hours",
  });
  assert.equal(generated.canShowEditButton, true);
  assert.equal(generated.openInEditMode, true);

  const cancelled = resolveRosterShiftDrawerEditEligibility({
    id: "shift-2",
    staff_id: STAFF_PAUL,
    clinic_id: null,
    shift_type: "clinic_day",
    starts_at: "2026-07-06T01:00:00.000Z",
    ends_at: "2026-07-06T09:00:00.000Z",
    status: "cancelled",
    notes: null,
    shift_source: "manual",
    cancellation_reason: "clinic_closed",
  });
  assert.equal(cancelled.canShowEditButton, false);
  assert.equal(cancelled.canCancelShift, false);
});

test("rosterAvailabilityLocalDateFromIso respects AWST vs AEST on the same UTC instant", () => {
  const iso = "2026-06-05T14:00:00.000Z";
  assert.equal(iso.slice(0, 10), "2026-06-05");
  assert.equal(
    rosterAvailabilityLocalDateFromIso(iso, "Australia/Perth", "Australia/Perth"),
    "2026-06-05"
  );
  assert.equal(
    rosterAvailabilityLocalDateFromIso(iso, "Australia/Sydney", "Australia/Perth"),
    "2026-06-06"
  );
});

test("rosterShiftDatetimeLocalToUtcIso converts Sydney wall times to UTC for manual create", () => {
  const result = rosterShiftDatetimeLocalToUtcIso({
    startsAtLocal: "2026-07-06T09:00",
    endsAtLocal: "2026-07-06T17:00",
    staffTimezone: "Australia/Sydney",
    tenantTimezone: "Australia/Sydney",
  });
  assert.ok(!("error" in result));
  assert.equal(result.startsAt, "2026-07-05T23:00:00.000Z");
  assert.equal(result.endsAt, "2026-07-06T07:00:00.000Z");
});

test("shiftMatchesRosterCellDate uses localDate not UTC prefix for AU shifts", () => {
  const shift = {
    staff_id: STAFF_PAUL,
    starts_at: "2026-07-05T23:00:00.000Z",
    localDate: "2026-07-06",
  };
  assert.equal(shiftMatchesRosterCellDate(shift, STAFF_PAUL, "2026-07-06"), true);
  assert.equal(shiftMatchesRosterCellDate(shift, STAFF_PAUL, "2026-07-05"), false);
  assert.equal(shift.starts_at.slice(0, 10), "2026-07-05");
});

test("rosterShiftDatetimeLocalToUtcIso validates missing and invalid ranges", () => {
  assert.deepEqual(
    rosterShiftDatetimeLocalToUtcIso({
      startsAtLocal: "",
      endsAtLocal: "2026-07-06T17:00",
      tenantTimezone: "Australia/Sydney",
    }),
    { error: ROSTER_SHIFT_START_END_REQUIRED_MESSAGE }
  );
  assert.deepEqual(
    rosterShiftDatetimeLocalToUtcIso({
      startsAtLocal: "2026-07-06T17:00",
      endsAtLocal: "2026-07-06T09:00",
      tenantTimezone: "Australia/Sydney",
    }),
    { error: ROSTER_SHIFT_INVALID_TIME_RANGE_MESSAGE }
  );
});

test("toRosterShiftDatetimeLocal uses staff timezone for edit form display", () => {
  assert.equal(
    toRosterShiftDatetimeLocal("2026-07-05T23:00:00.000Z", "Australia/Sydney", "Australia/Sydney"),
    "2026-07-06T09:00"
  );
});
