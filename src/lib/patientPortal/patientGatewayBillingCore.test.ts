import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

import {
  billingPayloadExposesInternalFields,
  buildPatientGatewayBillingSummary,
  centsToMajor,
  mapFiInvoiceStatusToPatient,
  mapInvoiceToPatientListItem,
  validateClientPaymentClaims,
} from "./patientGatewayBillingCore";

function invoice(overrides: Partial<FiInvoiceRow> = {}): FiInvoiceRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    clinic_id: null,
    patient_id: "11111111-1111-4111-8111-111111111111",
    lead_id: null,
    case_id: null,
    consultation_id: null,
    invoice_kind: "surgery_balance",
    status: "awaiting_payment",
    amount_cents: 800000,
    tax_cents: 0,
    total_cents: 800000,
    amount_paid_cents: 600000,
    currency: "AUD",
    due_date: "2026-08-01",
    issued_at: "2026-07-01T00:00:00.000Z",
    sent_at: "2026-07-01T00:00:00.000Z",
    paid_at: null,
    remaining_balance_cents: 200000,
    days_overdue: 0,
    last_reminder_sent_at: null,
    invoice_number: "INV-1234",
    title: "Hair restoration procedure",
    automation_hints: { staff: true },
    metadata: { margin: 1 },
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("patientGatewayBillingCore", () => {
  it("maps FiOS statuses to patient-safe vocabulary", () => {
    assert.equal(mapFiInvoiceStatusToPatient("awaiting_payment"), "outstanding");
    assert.equal(mapFiInvoiceStatusToPatient("partially_paid"), "partially_paid");
    assert.equal(mapFiInvoiceStatusToPatient("cancelled"), "void");
    assert.equal(mapFiInvoiceStatusToPatient("overdue"), "overdue");
  });

  it("A. builds deterministic account summary from FiOS cents", () => {
    const a = buildPatientGatewayBillingSummary([invoice()], true);
    const b = buildPatientGatewayBillingSummary([invoice()], true);
    assert.deepEqual(a, b);
    assert.equal(a.currency, "AUD");
    assert.equal(a.outstandingBalance, 2000);
    assert.equal(a.paidTotal, 6000);
    assert.equal(a.hasOutstandingBalance, true);
    assert.equal(a.nextPaymentDue?.amount, 2000);
  });

  it("H. patient invoice DTO omits internal finance fields", () => {
    const dto = mapInvoiceToPatientListItem(invoice(), true);
    assert.equal(billingPayloadExposesInternalFields(dto), false);
    assert.equal(dto.outstanding, 2000);
    assert.equal(dto.canPay, true);
    assert.equal(centsToMajor(200000), 2000);
  });

  it("M/N. client amount/currency tampering is rejected", () => {
    const amount = validateClientPaymentClaims({
      clientAmountMajor: 1,
      clientCurrency: null,
      serverAmountCents: 200000,
      serverCurrency: "AUD",
    });
    assert.equal(amount.ok, false);
    if (amount.ok) return;
    assert.equal(amount.code, "amount_mismatch");

    const currency = validateClientPaymentClaims({
      clientAmountMajor: null,
      clientCurrency: "USD",
      serverAmountCents: 200000,
      serverCurrency: "AUD",
    });
    assert.equal(currency.ok, false);
    if (currency.ok) return;
    assert.equal(currency.code, "currency_mismatch");
  });

  it("paid invoices are not payable", () => {
    const dto = mapInvoiceToPatientListItem(
      invoice({ status: "paid", amount_paid_cents: 800000, remaining_balance_cents: 0 }),
      true
    );
    assert.equal(dto.canPay, false);
    assert.equal(dto.status, "paid");
  });
});
