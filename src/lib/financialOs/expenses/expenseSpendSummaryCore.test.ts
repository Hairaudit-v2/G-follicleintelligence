import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateExpenseSpendByCategory } from "@/src/lib/financialOs/expenses/expenseSpendSummaryCore";
import {
  aggregateExpenseCostPerGraft,
  computeCostPerGraftCents,
  isClinicalConsumableExpense,
} from "@/src/lib/financialOs/expenses/expenseCostPerGraftCore";
import {
  normalizeExpensePeriod,
  periodFromPreset,
} from "@/src/lib/financialOs/expenses/expensePeriodCore";

describe("expensePeriodCore", () => {
  it("normalizes and swaps inverted ranges", () => {
    const p = normalizeExpensePeriod({
      periodStart: "2026-07-31",
      periodEnd: "2026-07-01",
    });
    assert.equal(p.period_start, "2026-07-01");
    assert.equal(p.period_end, "2026-07-31");
  });

  it("presets ytd and 30d", () => {
    const ytd = periodFromPreset("ytd", "2026-07-15");
    assert.equal(ytd.period_start, "2026-01-01");
    assert.equal(ytd.period_end, "2026-07-15");
    const m = periodFromPreset("30d", "2026-07-30");
    assert.equal(m.period_start, "2026-07-01");
  });
});

describe("expenseSpendSummaryCore", () => {
  it("aggregates posted spend by category", () => {
    const s = aggregateExpenseSpendByCategory({
      period_start: "2026-07-01",
      period_end: "2026-07-31",
      expenses: [
        {
          amount_cents: 10000,
          expense_date: "2026-07-10",
          status: "posted",
          category_code: "marketing_ads",
          category_label: "Marketing — paid ads",
        },
        {
          amount_cents: 5000,
          expense_date: "2026-07-11",
          status: "posted",
          category_code: "marketing_ads",
          category_label: "Marketing — paid ads",
        },
        {
          amount_cents: 2000,
          expense_date: "2026-07-12",
          status: "draft",
          category_code: "facilities",
          category_label: "Facilities",
        },
      ],
    });
    assert.equal(s.total_posted_spend_cents, 15000);
    assert.equal(s.expense_count, 2);
    assert.equal(s.by_category[0]?.category_code, "marketing_ads");
    assert.equal(s.by_category[0]?.pct_of_total, 100);
  });
});

describe("expenseCostPerGraftCore", () => {
  it("detects clinical categories", () => {
    assert.equal(isClinicalConsumableExpense("clinical_consumables"), true);
    assert.equal(isClinicalConsumableExpense("marketing_ads"), false);
  });

  it("computes actual CPG vs standard", () => {
    assert.equal(computeCostPerGraftCents(10000, 2000), 5);
    const summary = aggregateExpenseCostPerGraft({
      period_start: "2026-07-01",
      period_end: "2026-07-31",
      expenses: [
        {
          expense_id: "e1",
          amount_cents: 20000,
          expense_date: "2026-07-10",
          status: "posted",
          category_code: "clinical_consumables",
          case_id: "c1",
          procedure_type: null,
        },
      ],
      graftRows: [
        {
          case_id: "c1",
          procedure_type: "fue",
          grafts_implanted: 2000,
          procedure_date: "2026-07-10",
        },
      ],
      standards: [
        {
          procedure_type: "fue",
          graft_consumable_cost_cents: 8,
          standard_cost_per_graft_cents: 8,
        },
      ],
    });
    assert.equal(summary.total_grafts_implanted, 2000);
    assert.equal(summary.by_procedure[0]?.procedure_type, "fue");
    assert.equal(summary.by_procedure[0]?.actual_cost_per_graft_cents, 10);
    assert.equal(summary.by_procedure[0]?.variance_vs_standard_cents, 2);
  });
});
