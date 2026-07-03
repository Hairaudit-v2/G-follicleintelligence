import assert from "node:assert/strict";
import { test } from "node:test";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  buildRosterShiftDrawerDefaults,
  formatRosterShiftDrawerTitle,
  formatStandardHoursDrawerTitle,
  listStaffMissingStandardHours,
  resolveRosterCellClickIntent,
  ROSTER_GRID_SCROLL_CLASSES,
  ROSTER_PAGE_SCROLL_ROOT_CLASSES,
} from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import {
  applyStandardHoursTemplate,
  formatStandardHoursSummary,
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

test("resolveRosterCellClickIntent prefers standard hours setup before manual shift", () => {
  assert.equal(resolveRosterCellClickIntent({ hasStandardHours: false }), "open_standard_hours");
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
