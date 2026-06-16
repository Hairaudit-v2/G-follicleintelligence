import assert from "node:assert/strict";
import test from "node:test";

import { resolveConsultationQuoteInvoiceAmountCents } from "./consultationInvoiceAmountResolve";

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
