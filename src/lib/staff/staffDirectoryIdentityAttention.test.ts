/**
 * B1.1 — directory enrich preserves identity attention without dropping rows.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  enrichStaffDirectoryRows,
  filterStaffDirectoryRows,
} from "@/src/lib/staff/staffDirectoryFilters";
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

test("scheduling-only attention keeps the row visible in the directory", () => {
  const rows = enrichStaffDirectoryRows(
    [staff({ id: "sched-only", full_name: "No Lifecycle" })],
    {},
    {},
    {
      "sched-only": {
        employmentStatus: "active",
        archivedAt: null,
        hrLinked: false,
      },
    },
    {
      "sched-only": ["lifecycle_record_missing", "identity_link_incomplete"],
    }
  );

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]!.attentionReasons, [
    "lifecycle_record_missing",
    "identity_link_incomplete",
  ]);
  assert.equal(rows[0]!.isLifecycleActive, true);

  const visible = filterStaffDirectoryRows(rows, {
    staffRole: null,
    payrollOnly: false,
    activeFilter: "all",
  });
  assert.equal(visible.length, 1);
});

test("directory identity batch ordering is stable with staff id order", () => {
  const staffRows = [
    staff({ id: "b", full_name: "B" }),
    staff({ id: "a", full_name: "A" }),
    staff({ id: "c", full_name: "C" }),
  ];
  const rows = enrichStaffDirectoryRows(staffRows, {}, {}, {}, {
    a: ["identity_requires_reconciliation"],
  });
  assert.deepEqual(
    rows.map((r) => r.id),
    ["b", "a", "c"]
  );
  assert.deepEqual(rows[1]!.attentionReasons, ["identity_requires_reconciliation"]);
});
