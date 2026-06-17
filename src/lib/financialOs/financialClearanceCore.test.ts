import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFinancialClearance,
  buildFinancialClearanceFromPipelineStatus,
  FINANCIAL_CLEARANCE_STATE_LABELS,
  type BuildFinancialClearanceInput,
} from "@/src/lib/financialOs/financialClearanceCore";
import {
  buildFinanceApplicationAttentionSummary,
  type FiFinanceApplicationRow,
} from "@/src/lib/financialOs/financialFinanceApplicationsCore";
import {
  buildInternationalTransferAttentionSummary,
  type FiInternationalTransferApplicationRow,
} from "@/src/lib/financialOs/financialInternationalTransferCore";
import {
  buildPaymentPathwayAttentionSummary,
  type FiPaymentPathwayRow,
} from "@/src/lib/financialOs/financialPaymentPathwayCore";
import { buildPathwayTaskAttentionSummary, type FiPaymentPathwayTaskRow } from "@/src/lib/financialOs/financialPaymentPathwayInboxCore";
import {
  buildSuperReleaseAttentionSummary,
  type FiSuperReleaseApplicationRow,
} from "@/src/lib/financialOs/financialSuperReleaseCore";
import {
  buildFinancialSurgeryPipelineStatus,
  type FinancialSurgeryPipelineStatus,
} from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";
import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

const CASE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TODAY = "2026-06-16";
const TZ = "Australia/Brisbane";

function baseInvoice(
  p: Partial<FiInvoiceRow> & Pick<FiInvoiceRow, "id" | "invoice_kind" | "status" | "total_cents" | "amount_paid_cents">
): FiInvoiceRow {
  return {
    tenant_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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

function emptyAttentionInput(): Omit<
  BuildFinancialClearanceInput,
  | "todayYmd"
  | "calendarTimezone"
  | "booking_status"
  | "financial_os_status"
  | "surgeryDateYmd"
  | "financialDataAvailable"
  | "depositInvoiceState"
  | "balanceInvoiceState"
  | "amount_paid_cents"
  | "balance_due_cents"
  | "balance_overdue"
  | "balance_due_within_14_days"
  | "deposit_pending_for_confirmed_surgery"
  | "failed_payment_in_last_60_days"
  | "installment_overdue"
> {
  return {
    paymentPathway: buildPaymentPathwayAttentionSummary({ todayYmd: TODAY, surgeryDateYmd: null, pathway: null }),
    pathwayTaskAttention: buildPathwayTaskAttentionSummary([]),
    financeApplicationAttention: buildFinanceApplicationAttentionSummary({ todayYmd: TODAY, application: null }),
    superReleaseApplicationAttention: buildSuperReleaseAttentionSummary({ todayYmd: TODAY, application: null }),
    internationalTransferApplicationAttention: buildInternationalTransferAttentionSummary({
      todayYmd: TODAY,
      application: null,
    }),
  };
}

function pipelineFromInput(
  over: Partial<Parameters<typeof buildFinancialSurgeryPipelineStatus>[0]>
): FinancialSurgeryPipelineStatus {
  return buildFinancialSurgeryPipelineStatus({
    todayYmd: TODAY,
    calendarTimezone: TZ,
    booking_status: "confirmed",
    financial_os_status: null,
    case_id: CASE,
    patient_id: null,
    invoices: [],
    paymentRequests: [],
    payments: [],
    installmentPlans: [],
    ...over,
  });
}

function clearanceFromPipeline(
  pipeline: FinancialSurgeryPipelineStatus,
  over: {
    booking_status?: string | null;
    surgeryDateYmd?: string | null;
    financeSlaBreach?: boolean;
    financeRejected?: boolean;
    dataLoadFailed?: boolean;
  } = {}
) {
  return buildFinancialClearanceFromPipelineStatus({
    todayYmd: TODAY,
    calendarTimezone: TZ,
    booking_status: over.booking_status ?? "confirmed",
    surgeryDateYmd: over.surgeryDateYmd ?? null,
    dataLoadFailed: over.dataLoadFailed,
    financeSlaBreach: over.financeSlaBreach,
    financeRejected: over.financeRejected,
    pipeline,
  });
}

describe("financialClearanceCore", () => {
  it("no data → unavailable", () => {
    const pipeline = pipelineFromInput({});
    const c = clearanceFromPipeline(pipeline);
    assert.equal(c.clearance_state, "unavailable");
    assert.equal(c.clearance_label, FINANCIAL_CLEARANCE_STATE_LABELS.unavailable);
    assert.equal(c.financially_safe_to_proceed, false);
  });

  it("unpaid invoice/no pathway → not_ready", () => {
    const pipeline = pipelineFromInput({
      financial_os_status: "tentative",
      invoices: [
        baseInvoice({
          id: "11111111-1111-4111-8111-111111111111",
          invoice_kind: "surgery_deposit",
          status: "issued",
          total_cents: 500_00,
          amount_paid_cents: 0,
          due_date: "2026-07-01",
        }),
        baseInvoice({
          id: "22222222-2222-4222-8222-222222222222",
          invoice_kind: "surgery_balance",
          status: "issued",
          total_cents: 5000_00,
          amount_paid_cents: 0,
          due_date: "2026-08-01",
        }),
      ],
    });
    const c = clearanceFromPipeline(pipeline, { surgeryDateYmd: "2026-08-15" });
    assert.equal(c.clearance_state, "not_ready");
    assert.equal(c.financially_safe_to_proceed, false);
  });

  it("deposit paid + surgery outside balance window → deposit_ready", () => {
    const pipeline = pipelineFromInput({
      financial_os_status: "confirmed",
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
          status: "issued",
          total_cents: 5000_00,
          amount_paid_cents: 0,
          due_date: "2026-09-01",
        }),
      ],
    });
    const c = clearanceFromPipeline(pipeline, { surgeryDateYmd: "2026-09-15" });
    assert.equal(c.clearance_state, "deposit_ready");
    assert.equal(c.financially_safe_to_proceed, true);
    assert.ok(c.balance_due_cents > 0);
  });

  it("valid finance pending without SLA breach → pathway_pending", () => {
    const financeApp: FiFinanceApplicationRow = {
      id: "fin-1",
      application_status: "submitted",
      submitted_at: "2026-06-15T00:00:00.000Z",
      approved_at: null,
      settled_at: null,
      expected_settlement_date: "2026-07-01",
      created_at: "2026-06-15T00:00:00.000Z",
      updated_at: "2026-06-15T00:00:00.000Z",
      finance_provider_id: "prov-1",
      payment_pathway_id: "path-1",
      booking_id: "book-1",
    };
    const pathway: FiPaymentPathwayRow = {
      id: "path-1",
      pathway_type: "medical_finance",
      status: "pending_provider",
      provider: "Test Finance",
      provider_reference: null,
      expected_settlement_date: "2026-07-15",
      actual_settlement_date: null,
      expected_amount_cents: 5000_00,
      settled_amount_cents: null,
      currency_code: "AUD",
      created_at: "2026-06-10T00:00:00.000Z",
      updated_at: "2026-06-15T00:00:00.000Z",
    };
    const pipeline = pipelineFromInput({
      financial_os_status: "confirmed",
      paymentPathways: [pathway],
      financeApplication: financeApp,
      invoices: [
        baseInvoice({
          id: "11111111-1111-4111-8111-111111111111",
          invoice_kind: "surgery_deposit",
          status: "paid",
          total_cents: 500_00,
          amount_paid_cents: 500_00,
        }),
      ],
    });
    const c = clearanceFromPipeline(pipeline, { surgeryDateYmd: "2026-09-01" });
    assert.equal(c.clearance_state, "pathway_pending");
    assert.equal(c.requires_staff_attention, false);
  });

  it("rejected finance → attention_required", () => {
    const financeApp: FiFinanceApplicationRow = {
      id: "fin-1",
      application_status: "rejected",
      submitted_at: "2026-06-01T00:00:00.000Z",
      approved_at: null,
      settled_at: null,
      expected_settlement_date: null,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-10T00:00:00.000Z",
      finance_provider_id: "prov-1",
      payment_pathway_id: "path-1",
      booking_id: "book-1",
    };
    const pathway: FiPaymentPathwayRow = {
      id: "path-1",
      pathway_type: "medical_finance",
      status: "rejected",
      provider: "Test Finance",
      provider_reference: null,
      expected_settlement_date: null,
      actual_settlement_date: null,
      expected_amount_cents: 5000_00,
      settled_amount_cents: null,
      currency_code: "AUD",
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-10T00:00:00.000Z",
    };
    const pipeline = pipelineFromInput({
      paymentPathways: [pathway],
      financeApplication: financeApp,
      invoices: [
        baseInvoice({
          id: "11111111-1111-4111-8111-111111111111",
          invoice_kind: "surgery_deposit",
          status: "paid",
          total_cents: 500_00,
          amount_paid_cents: 500_00,
        }),
      ],
    });
    const c = clearanceFromPipeline(pipeline, { surgeryDateYmd: "2026-09-01", financeRejected: true });
    assert.equal(c.clearance_state, "attention_required");
    assert.equal(c.requires_staff_attention, true);
  });

  it("super release funds released → financially_cleared", () => {
    const superApp: FiSuperReleaseApplicationRow = {
      id: "super-1",
      application_status: "funds_released",
      submitted_at: "2026-05-01T00:00:00.000Z",
      approved_at: "2026-05-10T00:00:00.000Z",
      funds_released_at: "2026-06-01T00:00:00.000Z",
      expected_release_date: "2026-06-01",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
      payment_pathway_id: "path-super",
      booking_id: "book-1",
    };
    const pathway: FiPaymentPathwayRow = {
      id: "path-super",
      pathway_type: "super_release",
      status: "settled",
      provider: "Super Fund",
      provider_reference: null,
      expected_settlement_date: "2026-06-01",
      actual_settlement_date: "2026-06-01",
      expected_amount_cents: 5000_00,
      settled_amount_cents: 5000_00,
      currency_code: "AUD",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    };
    const pipeline = pipelineFromInput({
      paymentPathways: [pathway],
      superReleaseApplication: superApp,
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
          status: "issued",
          total_cents: 5000_00,
          amount_paid_cents: 0,
          due_date: "2026-09-01",
        }),
      ],
    });
    const c = clearanceFromPipeline(pipeline, { surgeryDateYmd: "2026-09-15" });
    assert.equal(c.clearance_state, "financially_cleared");
    assert.equal(c.financially_safe_to_proceed, true);
  });

  it("international transfer settled → financially_cleared", () => {
    const intlApp: FiInternationalTransferApplicationRow = {
      id: "intl-1",
      transfer_status: "settled",
      transfer_method: "bank_transfer",
      source_country_code: "GB",
      source_currency_code: "GBP",
      settlement_currency_code: "AUD",
      expected_amount_cents: 100_000,
      expected_settlement_amount_cents: 200_000,
      received_amount_cents: 200_000,
      expected_exchange_rate: 1.95,
      actual_exchange_rate: 1.94,
      fx_fee_cents: null,
      settlement_variance_cents: null,
      expected_settlement_date: "2026-06-01",
      actual_settlement_date: "2026-06-01",
      payment_reference: "REF123",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
      payment_pathway_id: "path-intl",
      booking_id: "book-1",
    };
    const pathway: FiPaymentPathwayRow = {
      id: "path-intl",
      pathway_type: "international_transfer",
      status: "settled",
      provider: "Intl",
      provider_reference: null,
      expected_settlement_date: "2026-06-01",
      actual_settlement_date: "2026-06-01",
      expected_amount_cents: 200_000,
      settled_amount_cents: 200_000,
      currency_code: "AUD",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    };
    const pipeline = pipelineFromInput({
      paymentPathways: [pathway],
      internationalTransferApplication: intlApp,
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
          status: "issued",
          total_cents: 5000_00,
          amount_paid_cents: 0,
          due_date: "2026-09-01",
        }),
      ],
    });
    const c = clearanceFromPipeline(pipeline, { surgeryDateYmd: "2026-09-15" });
    assert.equal(c.clearance_state, "financially_cleared");
  });

  it("balance due overdue → attention_required", () => {
    const pipeline = pipelineFromInput({
      financial_os_status: "confirmed",
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
          status: "overdue",
          total_cents: 5000_00,
          amount_paid_cents: 0,
          due_date: "2026-06-01",
        }),
      ],
    });
    const c = clearanceFromPipeline(pipeline, { surgeryDateYmd: "2026-07-01" });
    assert.equal(c.clearance_state, "attention_required");
    assert.ok(c.blocking_factors.some((f) => f.includes("overdue")));
  });

  it("paid in full with no blockers → paid_in_full", () => {
    const pipeline = pipelineFromInput({
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
    });
    const c = clearanceFromPipeline(pipeline);
    assert.equal(c.clearance_state, "paid_in_full");
    assert.equal(c.paid_in_full, true);
    assert.equal(c.financially_safe_to_proceed, true);
  });

  it("failed payment last 60 days → attention_required", () => {
    const pipeline = pipelineFromInput({
      financial_os_status: "confirmed",
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
          status: "issued",
          total_cents: 5000_00,
          amount_paid_cents: 0,
          due_date: "2026-09-01",
        }),
      ],
      payments: [
        {
          invoice_id: "22222222-2222-4222-8222-222222222222",
          status: "failed",
          created_at: "2026-06-10T00:00:00.000Z",
        },
      ],
    });
    const c = clearanceFromPipeline(pipeline, { surgeryDateYmd: "2026-09-15" });
    assert.equal(c.clearance_state, "attention_required");
    assert.ok(c.blocking_factors.some((f) => f.includes("Failed payment")));
  });

  it("installment overdue → attention_required", () => {
    const pipeline = pipelineFromInput({
      financial_os_status: "confirmed",
      invoices: [
        baseInvoice({
          id: "22222222-2222-4222-8222-222222222222",
          invoice_kind: "surgery_balance",
          status: "partially_paid",
          total_cents: 5000_00,
          amount_paid_cents: 1000_00,
          due_date: "2026-09-01",
        }),
      ],
      installmentPlans: [
        {
          invoice_id: "22222222-2222-4222-8222-222222222222",
          status: "active",
          next_payment_date: "2026-06-01",
          remaining_balance: 4000_00,
        },
      ],
    });
    const c = clearanceFromPipeline(pipeline, { surgeryDateYmd: "2026-09-15" });
    assert.equal(c.clearance_state, "attention_required");
    assert.ok(c.blocking_factors.some((f) => f.includes("Installment")));
  });

  it("unresolved pathway task → attention_required", () => {
    const task: FiPaymentPathwayTaskRow = {
      id: "task-1",
      task_type: "pathway_review",
      status: "open",
      priority: "normal",
      assigned_to: null,
      due_date: null,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    };
    const pipeline = pipelineFromInput({
      financial_os_status: "confirmed",
      pathwayTasks: [task],
      invoices: [
        baseInvoice({
          id: "11111111-1111-4111-8111-111111111111",
          invoice_kind: "surgery_deposit",
          status: "paid",
          total_cents: 500_00,
          amount_paid_cents: 500_00,
        }),
      ],
    });
    const c = clearanceFromPipeline(pipeline, { surgeryDateYmd: "2026-09-15" });
    assert.equal(c.clearance_state, "attention_required");
    assert.ok(
      c.blocking_factors.some(
        (f) => f.toLowerCase().includes("pathway") || f.toLowerCase().includes("workflow")
      )
    );
  });

  it("supports direct buildFinancialClearance with unavailable flag", () => {
    const c = buildFinancialClearance({
      todayYmd: TODAY,
      calendarTimezone: TZ,
      booking_status: "confirmed",
      financial_os_status: null,
      surgeryDateYmd: null,
      dataLoadFailed: true,
      financialDataAvailable: false,
      depositInvoiceState: "not_applicable",
      balanceInvoiceState: "not_applicable",
      amount_paid_cents: 0,
      balance_due_cents: 0,
      balance_overdue: false,
      balance_due_within_14_days: false,
      deposit_pending_for_confirmed_surgery: false,
      failed_payment_in_last_60_days: false,
      installment_overdue: false,
      ...emptyAttentionInput(),
    });
    assert.equal(c.clearance_state, "unavailable");
  });
});
