import assert from "node:assert/strict";
import test from "node:test";

import { resolveConsultationQuoteInvoiceAmountCents, resolveConsultationQuoteInvoiceSource } from "./consultationInvoiceAmountResolve";

test("prefers consultation quote_data.price_quoted", () => {
  const cents = resolveConsultationQuoteInvoiceAmountCents({ quote_data: { price_quoted: "$1,200 AUD" } }, []);
  assert.equal(cents, 120_000);
});

test("uses CRM quote subtotal_amount (dollars) when panel empty", () => {
  const cents = resolveConsultationQuoteInvoiceAmountCents(
    { quote_data: {} },
    [{ subtotal_amount: 2500.5, metadata: {}, line_items_snapshot: [] }]
  );
  assert.equal(cents, 250_050);
});

test("uses CRM quote metadata price hint when panel empty", () => {
  const cents = resolveConsultationQuoteInvoiceAmountCents(
    { quote_data: {} },
    [
      {
        subtotal_amount: null,
        total_amount: null,
        metadata: { price_quoted_hint: "9800 AUD" },
        line_items_snapshot: [],
      },
    ]
  );
  assert.equal(cents, 980_000);
});

test("resolveConsultationQuoteInvoiceSource: panel amount links primary (first) CRM quote id", () => {
  const qid = "550e8400-e29b-41d4-a716-446655440001";
  const src = resolveConsultationQuoteInvoiceSource(
    { quote_data: { price_quoted: "$500 AUD" } },
    [{ id: qid, subtotal_amount: null, total_amount: null, metadata: {}, line_items_snapshot: [] }]
  );
  assert.equal(src.amountCents, 50_000);
  assert.equal(src.crmQuoteId, qid);
});

test("resolveConsultationQuoteInvoiceSource: CRM subtotal carries that quote id for invoice metadata", () => {
  const qid = "650e8400-e29b-41d4-a716-446655440002";
  const src = resolveConsultationQuoteInvoiceSource(
    { quote_data: {} },
    [{ id: qid, subtotal_amount: 1200, metadata: {}, line_items_snapshot: [] }]
  );
  assert.equal(src.amountCents, 120_000);
  assert.equal(src.crmQuoteId, qid);
});
