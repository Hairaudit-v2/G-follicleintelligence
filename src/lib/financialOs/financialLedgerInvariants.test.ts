import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertLedgerRowsTenantScoped,
  FI_FINANCIAL_LEDGER_APPEND_ONLY,
  ledgerAuditRequiredForAppend,
  validateLedgerAppendInput,
} from "@/src/lib/financialOs/financialLedgerInvariantsCore";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

describe("FinancialOS ledger invariants", () => {
  it("declares append-only ledger contract", () => {
    assert.equal(FI_FINANCIAL_LEDGER_APPEND_ONLY, true);
    assert.equal(ledgerAuditRequiredForAppend(), true);
  });

  it("rejects missing tenantId", () => {
    const r = validateLedgerAppendInput({
      tenantId: "",
      amountCents: 100,
      transactionKind: "payment_received",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "tenant_id_required");
  });

  it("rejects negative amounts", () => {
    const r = validateLedgerAppendInput({
      tenantId: TENANT_A,
      amountCents: -50,
      transactionKind: "payment_received",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "negative_amount_not_allowed");
  });

  it("allows debit only for refund_processed", () => {
    const ok = validateLedgerAppendInput({
      tenantId: TENANT_A,
      amountCents: 500,
      direction: "debit",
      transactionKind: "refund_processed",
    });
    assert.equal(ok.ok, true);

    const blocked = validateLedgerAppendInput({
      tenantId: TENANT_A,
      amountCents: 500,
      direction: "debit",
      transactionKind: "payment_received",
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, "debit_only_refund_processed");
  });

  it("enforces tenant isolation on anchors", () => {
    const r = validateLedgerAppendInput({
      tenantId: TENANT_A,
      amountCents: 100,
      transactionKind: "invoice_created",
      anchorTenantId: TENANT_B,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "cross_tenant_anchor");
  });

  it("idempotency key prevents duplicate append semantics (same key same tenant normalizes)", () => {
    const key = `payment:pay-001`;
    const first = validateLedgerAppendInput({
      tenantId: TENANT_A,
      amountCents: 2500,
      transactionKind: "deposit_paid",
      idempotencyKey: key,
    });
    const second = validateLedgerAppendInput({
      tenantId: TENANT_A,
      amountCents: 2500,
      transactionKind: "deposit_paid",
      idempotencyKey: key,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.normalizedAmountCents, second.normalizedAmountCents);
    }
  });

  it("rejects cross-tenant idempotency prefix", () => {
    const r = validateLedgerAppendInput({
      tenantId: TENANT_A,
      amountCents: 100,
      transactionKind: "payment_received",
      idempotencyKey: `tenant:${TENANT_B}:payment:abc`,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "idempotency_key_cross_tenant");
  });

  it("assertLedgerRowsTenantScoped detects cross-tenant leakage", () => {
    assert.equal(
      assertLedgerRowsTenantScoped([{ tenant_id: TENANT_A }, { tenant_id: TENANT_A }], TENANT_A),
      true,
    );
    assert.equal(
      assertLedgerRowsTenantScoped([{ tenant_id: TENANT_A }, { tenant_id: TENANT_B }], TENANT_A),
      false,
    );
  });
});
