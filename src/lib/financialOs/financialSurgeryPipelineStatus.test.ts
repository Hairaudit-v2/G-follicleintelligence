import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFinancialSurgeryPipelineStatus,
  FINANCIAL_SURGERY_PIPELINE_UNAVAILABLE_COPY,
} from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";
import type { FiInvoiceRow, FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CASE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function baseInvoice(p: Partial<FiInvoiceRow> & Pick<FiInvoiceRow, "id" | "invoice_kind" | "status" | "total_cents" | "amount_paid_cents">): FiInvoiceRow {
  return {
    tenant_id: TID,
    clinic_id: null,
    patient_id: null,
    lead_id: null,
    case_id: CASE,
    consultation_id: null,
    tax_cents: 0,
    currency: "AUD",
    due_date: null,
    issued_at: null,
    invoice_number: null,
    title: null,
    automation_hints: {},
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    amount_cents: p.total_cents,
    ...p,
  } as FiInvoiceRow;
}

function baseInput(
  over: Partial<Parameters<typeof buildFinancialSurgeryPipelineStatus>[0]>
): Parameters<typeof buildFinancialSurgeryPipelineStatus>[0] {
  return {
    todayYmd: "2026-06-16",
    calendarTimezone: "Australia/Brisbane",
    booking_status: "confirmed",
    financial_os_status: null,
    case_id: CASE,
    patient_id: null,
    invoices: [],
    paymentRequests: [],
    payments: [],
    installmentPlans: [],
    ...over,
  };
}

describe("financialSurgeryPipelineStatusCore", () => {
  it("returns unavailable when no financial signals", () => {
    const s = buildFinancialSurgeryPipelineStatus(baseInput({}));
    assert.equal(s.financialDataAvailable, false);
    assert.equal(s.summary_label, FINANCIAL_SURGERY_PIPELINE_UNAVAILABLE_COPY);
    assert.equal(s.payment_attention_required, false);
  });

  it("paid in full when surgery invoices settled", () => {
    const s = buildFinancialSurgeryPipelineStatus(
      baseInput({
        financial_os_status: "paid_in_full",
        invoices: [
          baseInvoice({
            id: "11111111-1111-4111-8111-111111111111",
            invoice_kind: "surgery_deposit",
            status: "paid",
            total_cents: 500_00,
            amount_paid_cents: 500_00,
          }),
          baseInvoice({
            id: "22222222-2222-4222-8222-222222222222",
            invoice_kind: "surgery_balance",
            status: "paid",
            total_cents: 5000_00,
            amount_paid_cents: 5000_00,
          }),
        ],
      })
    );
    assert.equal(s.financialDataAvailable, true);
    assert.equal(s.payment_attention_required, false);
    assert.equal(s.summary_label, "Paid in full");
    assert.equal(s.balance_due_cents, 0);
  });

  it("flags deposit pending for confirmed surgery", () => {
    const s = buildFinancialSurgeryPipelineStatus(
      baseInput({
        booking_status: "confirmed",
        financial_os_status: "deposit_pending",
        invoices: [],
      })
    );
    assert.equal(s.deposit_pending_for_confirmed_surgery, true);
    assert.equal(s.payment_attention_required, true);
  });

  it("flags balance overdue on surgery_balance invoice", () => {
    const s = buildFinancialSurgeryPipelineStatus(
      baseInput({
        invoices: [
          baseInvoice({
            id: "33333333-3333-4333-8333-333333333333",
            invoice_kind: "surgery_balance",
            status: "overdue",
            total_cents: 2000_00,
            amount_paid_cents: 0,
            due_date: "2026-05-01",
          }),
        ],
      })
    );
    assert.equal(s.balance_overdue, true);
    assert.equal(s.payment_attention_required, true);
    assert.equal(s.summary_label, "Payment attention required");
  });

  it("installment active without overdue does not force attention by installment alone", () => {
    const invId = "44444444-4444-4444-8444-444444444444";
    const s = buildFinancialSurgeryPipelineStatus(
      baseInput({
        invoices: [
          baseInvoice({
            id: invId,
            invoice_kind: "surgery_balance",
            status: "partially_paid",
            total_cents: 5000_00,
            amount_paid_cents: 1000_00,
            due_date: "2026-12-31",
          }),
        ],
        installmentPlans: [
          { invoice_id: invId, status: "active", next_payment_date: "2026-07-01", remaining_balance: 4000_00 },
        ],
      })
    );
    assert.equal(s.installment_active, true);
    assert.equal(s.installment_overdue, false);
    assert.equal(s.payment_attention_required, false);
  });

  it("installment overdue triggers attention", () => {
    const invId = "55555555-5555-4555-8555-555555555555";
    const s = buildFinancialSurgeryPipelineStatus(
      baseInput({
        todayYmd: "2026-06-16",
        invoices: [
          baseInvoice({
            id: invId,
            invoice_kind: "surgery_balance",
            status: "partially_paid",
            total_cents: 5000_00,
            amount_paid_cents: 1000_00,
            due_date: "2026-12-31",
          }),
        ],
        installmentPlans: [
          { invoice_id: invId, status: "active", next_payment_date: "2026-06-01", remaining_balance: 4000_00 },
        ],
      })
    );
    assert.equal(s.installment_overdue, true);
    assert.equal(s.payment_attention_required, true);
  });

  it("failed payment in the last 60 days triggers attention", () => {
    const invId = "88888888-8888-4888-8888-888888888888";
    const s = buildFinancialSurgeryPipelineStatus(
      baseInput({
        invoices: [
          baseInvoice({
            id: invId,
            invoice_kind: "surgery_balance",
            status: "awaiting_payment",
            total_cents: 1000_00,
            amount_paid_cents: 0,
            due_date: "2026-12-31",
          }),
        ],
        payments: [
          {
            invoice_id: invId,
            status: "failed",
            created_at: "2026-06-10T12:00:00.000Z",
          },
        ],
      })
    );
    assert.equal(s.failed_payment_in_last_60_days, true);
    assert.equal(s.payment_attention_required, true);
  });

  it("balance due within 14 days triggers attention", () => {
    const s = buildFinancialSurgeryPipelineStatus(
      baseInput({
        todayYmd: "2026-06-16",
        invoices: [
          baseInvoice({
            id: "99999999-9999-4999-8999-999999999999",
            invoice_kind: "surgery_balance",
            status: "awaiting_payment",
            total_cents: 2000_00,
            amount_paid_cents: 0,
            due_date: "2026-06-25",
          }),
        ],
      })
    );
    assert.equal(s.balance_due_within_14_days, true);
    assert.equal(s.payment_attention_required, true);
  });

  it("surfaces latest payment request status", () => {
    const invId = "66666666-6666-4666-8666-666666666666";
    const pr: FiPaymentRequestRow = {
      id: "77777777-7777-4777-8777-777777777777",
      tenant_id: TID,
      invoice_id: invId,
      status: "sent",
      amount_cents: 100_00,
      tax_cents: 0,
      total_cents: 100_00,
      currency: "AUD",
      public_token: "tok",
      sent_at: null,
      viewed_at: null,
      checkout_url: null,
      provider: null,
      provider_checkout_session_id: null,
      expires_at: null,
      metadata: {},
      created_at: "2026-06-10T00:00:00.000Z",
      updated_at: "2026-06-10T00:00:00.000Z",
    };
    const s = buildFinancialSurgeryPipelineStatus(
      baseInput({
        invoices: [
          baseInvoice({
            id: invId,
            invoice_kind: "surgery_deposit",
            status: "awaiting_payment",
            total_cents: 500_00,
            amount_paid_cents: 0,
          }),
        ],
        paymentRequests: [pr],
      })
    );
    assert.equal(s.latest_payment_request_status, "sent");
  });
});
