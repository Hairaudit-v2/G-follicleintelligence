import assert from "node:assert/strict";
import test from "node:test";

import { periodFromPreset } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { isReportId } from "@/src/lib/reports/reportCatalog";

test("schedule presets resolve to valid YMD windows", () => {
  for (const preset of ["30d", "90d", "ytd"] as const) {
    const { period_start, period_end } = periodFromPreset(preset);
    assert.match(period_start, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(period_end, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(period_start <= period_end);
  }
});

test("scheduled report ids used in catalog remain valid", () => {
  for (const id of [
    "expense_breakdown",
    "marketing_cpl",
    "operating_pl",
    "surgery_gross_margin",
  ] as const) {
    assert.equal(isReportId(id), true);
  }
});
