import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchBankLinesToExpenses } from "@/src/lib/financialOs/expenses/expenseBankReconCore";
import {
  buildAccountingPushDryRun,
  buildExpensesCsv,
  buildQuickBooksExpenseCsv,
  buildQuickBooksPurchaseDrafts,
  buildXeroExpenseCsv,
} from "@/src/lib/financialOs/expenses/expenseExportCore";
import { aggregateMultiClinicOperatingPl } from "@/src/lib/financialOs/expenses/expenseChartOfAccountsCore";
import { aggregateOperatingPl } from "@/src/lib/financialOs/expenses/expensePlCore";

describe("expensePlCore", () => {
  it("nets opex and computes operating result", () => {
    const pl = aggregateOperatingPl({
      period_start: "2026-07-01",
      period_end: "2026-07-31",
      ledger: [
        {
          transaction_kind: "payment_received",
          direction: "credit",
          amount_cents: 100000,
          created_at: "2026-07-10T00:00:00Z",
        },
        {
          transaction_kind: "expense_posted",
          direction: "debit",
          amount_cents: 25000,
          created_at: "2026-07-11T00:00:00Z",
        },
        {
          transaction_kind: "expense_void_reversal",
          direction: "credit",
          amount_cents: 5000,
          created_at: "2026-07-12T00:00:00Z",
        },
      ],
    });
    assert.equal(pl.revenue_collected_cents, 100000);
    assert.equal(pl.opex_net_cents, 20000);
    assert.equal(pl.net_operating_cents, 80000);
  });
});

describe("expenseBankReconCore", () => {
  it("matches by import line id and amount/date", () => {
    const result = matchBankLinesToExpenses({
      lines: [
        {
          id: "line-1",
          transaction_date: "2026-07-10",
          amount_cents: 5000,
          external_ref: null,
          description_raw: "META ADS",
          vendor_name: "Meta",
          status: "committed",
        },
        {
          id: "line-2",
          transaction_date: "2026-07-11",
          amount_cents: 1200,
          external_ref: null,
          description_raw: "Cafe",
          vendor_name: "Cafe",
          status: "draft",
        },
      ],
      expenses: [
        {
          id: "exp-1",
          expense_date: "2026-07-10",
          amount_cents: 5000,
          vendor_name: "Meta",
          description: null,
          status: "posted",
          source_import_line_id: "line-1",
        },
        {
          id: "exp-2",
          expense_date: "2026-07-11",
          amount_cents: 1200,
          vendor_name: "Cafe XYZ",
          description: null,
          status: "posted",
          source_import_line_id: null,
        },
      ],
    });
    assert.equal(result.matches.length, 2);
    assert.ok(result.matches.some((m) => m.reason === "source_import_line_id"));
    assert.equal(result.unmatched_line_ids.length, 0);
  });
});

describe("expenseExportCore + QuickBooks", () => {
  const rows = [
    {
      id: "e1",
      expense_date: "2026-07-10",
      amount_cents: 25000,
      currency: "AUD",
      status: "posted",
      vendor_name: "Meta",
      description: "Ads",
      category_code: "marketing_ads",
      category_label: "Marketing — paid ads",
      campaign_key: "meta_q3",
      lead_id: null,
      case_id: null,
      procedure_type: null,
      payment_method: "card",
      ledger_post_transaction_id: "tx1",
    },
  ] as const;

  it("builds FI and QuickBooks CSV", () => {
    const fi = buildExpensesCsv(rows);
    assert.match(fi, /expense_id/);
    assert.match(fi, /250\.00/);
    const qb = buildQuickBooksExpenseCsv(rows);
    assert.match(qb, /FI Expense Id/);
    assert.match(qb, /Marketing — paid ads/);
  });

  it("builds QuickBooks purchase drafts", () => {
    const drafts = buildQuickBooksPurchaseDrafts(rows);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0]?.TotalAmt, 250);
    assert.equal(drafts[0]?.fi_expense_id, "e1");
    assert.equal(drafts[0]?.Line[0]?.DetailType, "AccountBasedExpenseLineDetail");
  });

  it("builds Xero spend CSV and dry-run push gate", () => {
    const xero = buildXeroExpenseCsv(rows);
    assert.match(xero, /\*Date/);
    assert.match(xero, /-250\.00/);
    const blocked = buildAccountingPushDryRun({
      provider: "quickbooks",
      rows,
      connectorConfigured: false,
      livePushEnabled: false,
    });
    assert.equal(blocked.ready, false);
    const ready = buildAccountingPushDryRun({
      provider: "xero",
      rows,
      connectorConfigured: true,
      livePushEnabled: true,
    });
    assert.equal(ready.ready, true);
  });
});

describe("expenseChartOfAccountsCore multi-clinic", () => {
  it("splits P&L by clinic", () => {
    const names = new Map([["c1", "Perth"], ["c2", "Sydney"]]);
    const summary = aggregateMultiClinicOperatingPl({
      period_start: "2026-07-01",
      period_end: "2026-07-31",
      clinicNames: names,
      ledger: [
        {
          clinic_id: "c1",
          transaction_kind: "payment_received",
          direction: "credit",
          amount_cents: 50000,
          created_at: "2026-07-10T00:00:00Z",
        },
        {
          clinic_id: "c1",
          transaction_kind: "expense_posted",
          direction: "debit",
          amount_cents: 10000,
          created_at: "2026-07-11T00:00:00Z",
        },
        {
          clinic_id: "c2",
          transaction_kind: "payment_received",
          direction: "credit",
          amount_cents: 30000,
          created_at: "2026-07-12T00:00:00Z",
        },
      ],
    });
    assert.equal(summary.by_clinic.length, 2);
    assert.equal(summary.totals.revenue_collected_cents, 80000);
    assert.equal(summary.totals.opex_net_cents, 10000);
    assert.equal(summary.totals.net_operating_cents, 70000);
  });
});
