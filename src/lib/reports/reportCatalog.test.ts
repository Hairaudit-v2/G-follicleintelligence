import assert from "node:assert/strict";
import test from "node:test";

import {
  REPORT_CATALOG,
  buildReportLiveHref,
  getReportDefinition,
  isReportId,
  listReports,
} from "./reportCatalog";

test("catalog includes expense_breakdown as generate-enabled Phase 1 report", () => {
  const def = getReportDefinition("expense_breakdown");
  assert.ok(def);
  assert.equal(def?.generateEnabled, true);
  assert.equal(def?.category, "financial");
  assert.ok(def?.requiredModules.includes("financial_os"));
});

test("listReports filters by category and query", () => {
  const financial = listReports({ category: "financial", phaseMax: 1 });
  assert.ok(financial.every((r) => r.category === "financial"));
  assert.ok(financial.some((r) => r.id === "expense_breakdown"));

  const search = listReports({ query: "graft", phaseMax: 1 });
  assert.ok(search.some((r) => r.id === "cost_per_graft_actuals"));
  assert.ok(!search.some((r) => r.id === "ar_aging_summary"));
});

test("isReportId and live href helpers", () => {
  assert.equal(isReportId("expense_breakdown"), true);
  assert.equal(isReportId("nope"), false);
  assert.equal(
    buildReportLiveHref("t-1", getReportDefinition("expense_breakdown")!),
    "/fi-admin/t-1/financial/expenses"
  );
});

test("phase 1 financial core reports are generate-enabled", () => {
  const enabled = REPORT_CATALOG.filter((r) => r.phase === 1 && r.generateEnabled).map(
    (r) => r.id
  );
  for (const id of [
    "expense_breakdown",
    "marketing_cpl",
    "cost_per_graft_actuals",
    "operating_pl",
  ] as const) {
    assert.ok(enabled.includes(id), `${id} should be generate-enabled`);
  }
  assert.equal(enabled.length, 4);
});
