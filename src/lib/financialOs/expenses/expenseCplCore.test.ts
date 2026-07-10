import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateExpenseCpl,
  computeCplCents,
  defaultCplPeriod,
  isMarketingExpense,
} from "@/src/lib/financialOs/expenses/expenseCplCore";

describe("expenseCplCore", () => {
  it("identifies marketing expenses", () => {
    assert.equal(isMarketingExpense({ category_code: "marketing_ads" }), true);
    assert.equal(isMarketingExpense({ campaign_key: "meta_q3" }), true);
    assert.equal(isMarketingExpense({ category_code: "facilities" }), false);
  });

  it("computes cpl cents", () => {
    assert.equal(computeCplCents(10000, 4), 2500);
    assert.equal(computeCplCents(10000, 0), null);
  });

  it("aggregates by campaign", () => {
    const summary = aggregateExpenseCpl({
      period_start: "2026-07-01",
      period_end: "2026-07-31",
      expenses: [
        {
          expense_id: "e1",
          amount_cents: 50000,
          expense_date: "2026-07-10",
          campaign_key: "Meta_Q3",
          category_code: "marketing_ads",
          status: "posted",
        },
        {
          expense_id: "e2",
          amount_cents: 10000,
          expense_date: "2026-07-12",
          campaign_key: null,
          category_code: "marketing_other",
          status: "posted",
        },
        {
          expense_id: "e3",
          amount_cents: 99999,
          expense_date: "2026-07-12",
          campaign_key: "meta_q3",
          category_code: "marketing_ads",
          status: "draft",
        },
      ],
      leads: [
        { lead_id: "l1", created_at: "2026-07-05T10:00:00Z", campaign_key: "meta_q3" },
        { lead_id: "l2", created_at: "2026-07-08T10:00:00Z", campaign_key: "meta_q3" },
        { lead_id: "l3", created_at: "2026-07-09T10:00:00Z", campaign_key: null },
      ],
    });

    assert.equal(summary.total_marketing_spend_cents, 60000);
    assert.equal(summary.unattributed_spend_cents, 10000);
    assert.equal(summary.total_leads, 3);
    assert.equal(summary.overall_cpl_cents, 20000);
    const meta = summary.by_campaign.find((r) => r.campaign_key === "meta_q3");
    assert.ok(meta);
    assert.equal(meta!.spend_cents, 50000);
    assert.equal(meta!.lead_count, 2);
    assert.equal(meta!.cpl_cents, 25000);
  });

  it("default period is 30 days inclusive", () => {
    const p = defaultCplPeriod("2026-07-30");
    assert.equal(p.period_end, "2026-07-30");
    assert.equal(p.period_start, "2026-07-01");
  });
});
