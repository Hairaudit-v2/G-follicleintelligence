import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReportLiveHrefWithPeriod,
  hasReportFilters,
  reportFilterFields,
} from "./reportFilters";

test("reportFilterFields maps phase-2 optional filters", () => {
  assert.deepEqual(reportFilterFields("surgery_gross_margin"), [
    "procedureType",
    "snapshotStatus",
  ]);
  assert.deepEqual(reportFilterFields("revenue_attribution_summary"), [
    "attributionSource",
    "campaign",
    "procedureType",
  ]);
  assert.deepEqual(reportFilterFields("ar_aging_summary"), ["arRisk"]);
  assert.deepEqual(reportFilterFields("expense_breakdown"), []);
  assert.equal(hasReportFilters("marketing_cpl"), false);
  assert.equal(hasReportFilters("ar_aging_summary"), true);
});

test("buildReportLiveHrefWithPeriod uses surface-specific query prefixes", () => {
  assert.equal(
    buildReportLiveHrefWithPeriod(
      "t-1",
      "financial/expenses",
      { from: "2026-01-01", to: "2026-01-31" },
      "expense_breakdown"
    ),
    "/fi-admin/t-1/financial/expenses?from=2026-01-01&to=2026-01-31"
  );
  assert.equal(
    buildReportLiveHrefWithPeriod(
      "t-1",
      "financial-os",
      { from: "2026-01-01", to: "2026-01-31" },
      "surgery_gross_margin"
    ),
    "/fi-admin/t-1/financial-os?se_from=2026-01-01&se_to=2026-01-31"
  );
  assert.equal(
    buildReportLiveHrefWithPeriod(
      "t-1",
      "financial-os",
      { from: "2026-01-01", to: "2026-01-31" },
      "revenue_attribution_summary"
    ),
    "/fi-admin/t-1/financial-os?ra_from=2026-01-01&ra_to=2026-01-31"
  );
});
