import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertPathwayFixtureInvariants,
  buildFinancialOsPathwayFixture,
  FINANCIAL_OS_PATHWAY_FIXTURE_TENANT_ID,
} from "@/src/lib/financialOs/financialOsPathwayFixture";
import { assertLedgerRowsTenantScoped } from "@/src/lib/financialOs/financialLedgerInvariantsCore";

describe("FinancialOS pathway fixture", () => {
  it("models lead → quote → payment → deposit partial payment timeline", () => {
    const fixture = buildFinancialOsPathwayFixture();
    assert.equal(fixture.quoteInvoice.status, "paid");
    assert.equal(fixture.depositInvoice.status, "partially_paid");
    assert.equal(fixture.depositInvoice.remaining_balance_cents, 30_000);
    assert.equal(fixture.ledgerTimeline.length, 4);
    assert.doesNotThrow(() => assertPathwayFixtureInvariants(fixture));
  });

  it("enforces tenant isolation on fixture ledger rows", () => {
    const fixture = buildFinancialOsPathwayFixture();
    assert.equal(
      assertLedgerRowsTenantScoped(fixture.ledgerTimeline, FINANCIAL_OS_PATHWAY_FIXTURE_TENANT_ID),
      true,
    );
  });
});
