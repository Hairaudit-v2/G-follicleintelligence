import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  majorToCents,
  parseAmountToSignedMajor,
  parseExpenseBankCsv,
  parseFlexibleDateToYmd,
  splitCsvLine,
} from "@/src/lib/financialOs/expenses/expenseCsvParse";
import {
  assertImportLineCommitEligible,
  buildImportLineDraftsFromCsv,
} from "@/src/lib/financialOs/expenses/expenseImportCore";
import { suggestCategoryCodeFromText } from "@/src/lib/financialOs/expenses/expenseCategories";

describe("expenseCsvParse", () => {
  it("splits quoted CSV fields", () => {
    assert.deepEqual(splitCsvLine('a,"b, c",d'), ["a", "b, c", "d"]);
  });

  it("parses AU dates and amounts", () => {
    assert.equal(parseFlexibleDateToYmd("01/07/2026"), "2026-07-01");
    assert.equal(parseFlexibleDateToYmd("2026-07-01"), "2026-07-01");
    assert.equal(parseAmountToSignedMajor("-250.50"), -250.5);
    assert.equal(parseAmountToSignedMajor("1,234.00"), 1234);
    assert.equal(majorToCents(12.34), 1234);
  });

  it("parses a simple bank CSV into expense lines", () => {
    const csv = [
      "Date,Description,Amount",
      "01/07/2026,META ADS AUD,-250.00",
      "02/07/2026,GOOGLE ADS,100.00",
      "03/07/2026,Unknown merchant,0",
    ].join("\n");

    const result = parseExpenseBankCsv(csv);
    assert.equal(result.ok, true);
    assert.equal(result.lines.length, 3);
    assert.equal(result.lines[0]?.amountCents, 25000);
    assert.equal(result.lines[0]?.transactionDate, "2026-07-01");
    assert.match(result.lines[0]?.descriptionRaw ?? "", /META/i);
  });

  it("parses debit/credit columns and skips pure credits", () => {
    const csv = [
      "Date,Narrative,Debit,Credit",
      "01/07/2026,Office supplies,45.00,",
      "02/07/2026,Patient refund deposit,,100.00",
    ].join("\n");
    const result = parseExpenseBankCsv(csv);
    assert.equal(result.ok, true);
    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0]?.amountCents, 4500);
  });

  it("fails when required columns are missing", () => {
    const result = parseExpenseBankCsv("Foo,Bar\n1,2");
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
  });
});

describe("expenseImportCore + categories", () => {
  it("suggests marketing category from merchant text", () => {
    assert.equal(suggestCategoryCodeFromText("META ADS AUD"), "marketing_ads");
    assert.equal(suggestCategoryCodeFromText("random cafe"), null);
  });

  it("builds drafts with suggested category ids", () => {
    const parsed = parseExpenseBankCsv("Date,Description,Amount\n01/07/2026,META ADS,-10.00");
    const map = new Map([["marketing_ads", "cat-1"]]);
    const drafts = buildImportLineDraftsFromCsv(parsed.lines, map);
    assert.equal(drafts[0]?.suggested_category_code, "marketing_ads");
    assert.equal(drafts[0]?.suggested_category_id, "cat-1");
  });

  it("validates commit eligibility", () => {
    assert.equal(
      assertImportLineCommitEligible({
        status: "draft",
        amount_cents: 100,
        transaction_date: "2026-07-01",
      }).ok,
      true
    );
    assert.equal(
      assertImportLineCommitEligible({
        status: "rejected",
        amount_cents: 100,
        transaction_date: "2026-07-01",
      }).ok,
      false
    );
    assert.equal(
      assertImportLineCommitEligible({
        status: "draft",
        amount_cents: 100,
        transaction_date: null,
      }).ok,
      false
    );
  });
});
