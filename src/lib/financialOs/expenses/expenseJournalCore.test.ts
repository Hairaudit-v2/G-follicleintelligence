import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildExpensePostJournal,
  buildExpenseVoidJournal,
  fundingGlForPaymentMethod,
  isJournalBalanced,
} from "@/src/lib/financialOs/expenses/expenseJournalCore";

describe("expenseJournalCore", () => {
  it("builds balanced post and void journals", () => {
    const post = buildExpensePostJournal({
      expense_date: "2026-07-10",
      amount_cents: 12500,
      expense_gl: { code: "6100", name: "Marketing" },
      funding_gl: { code: "1000", name: "Cash" },
      memo: "Ads",
    });
    assert.equal(post.balanced, true);
    assert.equal(post.total_debit_cents, 12500);
    assert.equal(post.lines[0]?.side, "debit");
    assert.equal(post.lines[1]?.side, "credit");

    const voidJ = buildExpenseVoidJournal({
      expense_date: "2026-07-10",
      amount_cents: 12500,
      expense_gl: { code: "6100", name: "Marketing" },
      funding_gl: { code: "1000", name: "Cash" },
    });
    assert.equal(voidJ.balanced, true);
    assert.equal(voidJ.lines[0]?.side, "debit");
    assert.equal(voidJ.source, "expense_void");
  });

  it("maps payment methods to funding accounts", () => {
    assert.equal(fundingGlForPaymentMethod("card").code, "1000");
    assert.equal(fundingGlForPaymentMethod(null).code, "2000");
  });

  it("detects unbalanced lines", () => {
    assert.equal(
      isJournalBalanced([
        {
          side: "debit",
          amount_cents: 100,
          gl_account_code: "A",
          gl_account_name: "A",
          sort_order: 0,
        },
      ]),
      false
    );
  });
});
