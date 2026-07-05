import assert from "node:assert/strict";
import { test } from "node:test";

import {
  enrichStaffDirectoryRows,
  filterStaffDirectoryRows,
  type StaffDirectoryLifecycleSignal,
} from "@/src/lib/staff/staffDirectoryFilters";
import { buildWorkforceCommandCentreMetrics } from "@/src/lib/staff/workforceCommandCentre";
import type { FiStaffRow } from "@/src/lib/staff/staff.server";

function staff(p: Partial<FiStaffRow> & Pick<FiStaffRow, "id" | "full_name">): FiStaffRow {
  return {
    tenant_id: "t1",
    fi_user_id: null,
    staff_role: "consultant",
    position_type_id: null,
    email: null,
    mobile: null,
    default_timezone: null,
    working_hours: {},
    staff_metadata: {},
    is_active: true,
    calendar_color: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "",
    ...p,
  };
}

const TERMINATED: StaffDirectoryLifecycleSignal = {
  employmentStatus: "terminated",
  archivedAt: "2026-07-03T09:55:19.575Z",
};

test("directory rows never label terminated staff Active when is_active drifted true", () => {
  const rows = enrichStaffDirectoryRows(
    [
      staff({ id: "active-1", full_name: "Danica Miloseski" }),
      staff({ id: "terminated-1", full_name: "Clara Quinn", is_active: true }),
    ],
    {},
    {},
    { "terminated-1": TERMINATED }
  );

  const terminated = rows.find((r) => r.id === "terminated-1")!;
  assert.equal(terminated.lifecycleStatus, "terminated");
  assert.equal(terminated.isLifecycleActive, false);
  assert.equal(terminated.lifecycleLabel, "Terminated");

  const active = rows.find((r) => r.id === "active-1")!;
  assert.equal(active.lifecycleStatus, "active");
  assert.equal(active.isLifecycleActive, true);
});

test("active count and active-filtered list agree (counts match the visible list)", () => {
  const rows = enrichStaffDirectoryRows(
    [
      staff({ id: "a", full_name: "Active One" }),
      staff({ id: "b", full_name: "Terminated One", is_active: true }),
      staff({ id: "c", full_name: "Suspended One", is_active: true }),
      staff({ id: "d", full_name: "Plain Inactive", is_active: false }),
    ],
    {},
    {},
    {
      b: TERMINATED,
      c: { employmentStatus: "suspended", archivedAt: null },
    }
  );

  const metrics = buildWorkforceCommandCentreMetrics(rows, {});
  const visibleActive = filterStaffDirectoryRows(rows, {
    staffRole: null,
    payrollOnly: false,
    activeFilter: "active",
  });

  assert.equal(metrics.activeStaff, 1);
  assert.equal(visibleActive.length, metrics.activeStaff);
  assert.deepEqual(
    visibleActive.map((r) => r.id),
    ["a"]
  );

  const visibleInactive = filterStaffDirectoryRows(rows, {
    staffRole: null,
    payrollOnly: false,
    activeFilter: "inactive",
  });
  assert.equal(visibleInactive.length, rows.length - metrics.activeStaff);
});

test("duplicate staff records are flagged with the canonical id (Dr Seetal scenario)", () => {
  const rows = enrichStaffDirectoryRows(
    [
      staff({
        id: "old-surgeon",
        full_name: "Dr Seetal",
        staff_role: "surgeon",
        is_active: false,
        created_at: "2026-06-16T03:26:26.866Z",
      }),
      staff({
        id: "contractor",
        full_name: "Dr Seetal",
        staff_role: "Contractor Doctor / Hair Transplant Surgeon",
        email: "seetskd@gmail.com",
        is_active: true,
        created_at: "2026-07-01T04:59:28.064Z",
      }),
    ],
    {},
    {},
    {
      "old-surgeon": { employmentStatus: "active", archivedAt: "2026-07-03T09:58:21.854Z" },
      contractor: { employmentStatus: "active", archivedAt: null, hrLinked: true },
    }
  );

  const oldRow = rows.find((r) => r.id === "old-surgeon")!;
  const canonicalRow = rows.find((r) => r.id === "contractor")!;

  assert.equal(oldRow.lifecycleStatus, "archived");
  assert.equal(oldRow.isDuplicate, true);
  assert.equal(oldRow.duplicateOfStaffId, "contractor");
  assert.equal(canonicalRow.isDuplicate, false);
  assert.equal(canonicalRow.isLifecycleActive, true);
});

test("rows without an HR lifecycle signal fall back to is_active", () => {
  const rows = enrichStaffDirectoryRows(
    [staff({ id: "x", full_name: "No HR Row", is_active: false })],
    {},
    {}
  );
  assert.equal(rows[0]!.lifecycleStatus, "inactive");
  assert.equal(rows[0]!.isLifecycleActive, false);
});
