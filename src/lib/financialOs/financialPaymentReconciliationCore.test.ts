import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compareReconciliationAmounts } from "@/src/lib/financialOs/financialPaymentReconciliationCore";

describe("FinancialOS reconciliation mismatch handling", () => {
  it("matches when expected equals received", () => {
    const r = compareReconciliationAmounts(50000, 50000);
    assert.equal(r.matched, true);
    if (r.matched) {
      assert.equal(r.expectedCents, 50000);
      assert.equal(r.receivedCents, 50000);
    }
  });

  it("flags unmatched when amounts differ", () => {
    const r = compareReconciliationAmounts(50000, 49999);
    assert.equal(r.matched, false);
    if (!r.matched) {
      assert.equal(r.varianceCents, -1);
      assert.equal(r.expectedCents, 50000);
      assert.equal(r.receivedCents, 49999);
    }
  });
});
