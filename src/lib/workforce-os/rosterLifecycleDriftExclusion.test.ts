import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRosterStaffEligibilityContext,
  filterRosterGridStaffOptions,
  type RosterStaffMemberContext,
  type RosterStaffRowContext,
} from "@/src/lib/workforce-os/rosterEligibleStaffCore";

const PERIOD = ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"];

function staffRow(p: Partial<RosterStaffRowContext> & Pick<RosterStaffRowContext, "id">): RosterStaffRowContext {
  return {
    is_active: true,
    tenant_id: "t1",
    full_name: "Staff",
    staff_role: "consultant",
    default_timezone: "Australia/Perth",
    ...p,
  };
}

test("terminated staff with drifted is_active=true are excluded from the roster grid", () => {
  const staffRows = [
    staffRow({ id: "ok", full_name: "Danica Miloseski" }),
    staffRow({ id: "terminated-drift", full_name: "Clara Quinn", is_active: true }),
  ];
  const members = new Map<string, RosterStaffMemberContext>([
    ["terminated-drift", { employment_status: "terminated", archived_at: "2026-07-03T09:55:19Z" }],
    ["ok", { employment_status: "active", archived_at: null }],
  ]);

  const ctx = buildRosterStaffEligibilityContext({
    staffRows,
    membersByFiStaffId: members,
    periodDayDates: PERIOD,
  });

  assert.deepEqual(ctx.eligibleStaffIds, ["ok"]);
  const gridOptions = filterRosterGridStaffOptions(staffRows, ctx.eligibleStaffIds);
  assert.deepEqual(
    gridOptions.map((s) => s.id),
    ["ok"]
  );
  const excluded = ctx.ineligibleStaffOptions.find((s) => s.id === "terminated-drift");
  assert.ok(excluded, "terminated staff must appear in the not-rostered list");
});

test("inactive duplicate (Dr Seetal) is excluded and labelled as a duplicate profile", () => {
  const staffRows = [
    staffRow({ id: "canonical", full_name: "Dr Seetal", staff_role: "Contractor Doctor" }),
    staffRow({ id: "old-dup", full_name: "Dr Seetal", staff_role: "surgeon", is_active: false }),
  ];
  const members = new Map<string, RosterStaffMemberContext>([
    ["canonical", { employment_status: "active", archived_at: null }],
    ["old-dup", { employment_status: "active", archived_at: "2026-07-03T09:58:21Z" }],
  ]);

  const ctx = buildRosterStaffEligibilityContext({
    staffRows,
    membersByFiStaffId: members,
    periodDayDates: PERIOD,
  });

  assert.deepEqual(ctx.eligibleStaffIds, ["canonical"]);
  const dup = ctx.ineligibleStaffOptions.find((s) => s.id === "old-dup");
  assert.ok(dup);
  assert.equal(dup!.reason, "inactive_duplicate");

  // Scheduling must never target the duplicate record.
  const gridOptions = filterRosterGridStaffOptions(staffRows, ctx.eligibleStaffIds);
  assert.equal(gridOptions.some((s) => s.id === "old-dup"), false);
});
