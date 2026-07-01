import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPayPeriodExportBundle,
  buildPayPeriodExportEntryRows,
  minutesToExportHours,
  serializePayPeriodExportCsv,
} from "./payPeriodExportCore";
import type { TimesheetEntry } from "./wageProfileCore";

function sampleEntry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    id: "e1",
    tenantId: "t1",
    staffMemberId: "s1",
    staffFullName: "Alex Smith",
    wageProfileId: null,
    shiftId: null,
    workDate: "2026-07-01",
    entryType: "regular",
    minutesWorked: 480,
    rateTypeSnapshot: "hourly",
    baseRateCentsSnapshot: 3500,
    awardLoadingsSnapshot: [],
    grossCostCents: 28000,
    status: "approved",
    notes: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("payPeriodExportCore", () => {
  it("converts minutes to decimal hours", () => {
    assert.equal(minutesToExportHours(90), 1.5);
    assert.equal(minutesToExportHours(480), 8);
  });

  it("filters approved-only rows by scope", () => {
    const entries = [
      sampleEntry({ id: "e1", status: "approved" }),
      sampleEntry({ id: "e2", status: "submitted", minutesWorked: 60 }),
    ];
    const refs = new Map([
      ["s1", { staffMemberId: "s1", fiStaffId: "fs-1", staffFullName: "Alex Smith" }],
    ]);
    const approved = buildPayPeriodExportEntryRows(entries, refs, "approved");
    assert.equal(approved.rows.length, 1);
    assert.equal(approved.unapprovedEntryCount, 1);
    const all = buildPayPeriodExportEntryRows(entries, refs, "all");
    assert.equal(all.rows.length, 2);
  });

  it("serializes summary CSV with metadata", () => {
    const bundle = buildPayPeriodExportBundle({
      tenantId: "tenant-1",
      payPeriod: {
        start: "2026-07-01",
        end: "2026-07-14",
        frequency: "fortnightly",
        label: "2026-07-01 → 2026-07-14",
      },
      entries: [sampleEntry()],
      staffRefs: new Map([
        ["s1", { staffMemberId: "s1", fiStaffId: "fs-1", staffFullName: "Alex Smith" }],
      ]),
      scope: "approved",
      view: "summary",
      exportedAt: "2026-07-15T10:00:00.000Z",
    });
    const csv = serializePayPeriodExportCsv(bundle);
    assert.match(csv, /pay_period_start,2026-07-01/);
    assert.match(csv, /staff_name,employee_id/);
    assert.match(csv, /Alex Smith,fs-1,8,480,280\.00/);
  });
});