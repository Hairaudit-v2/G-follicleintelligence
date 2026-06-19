/**
 * Complete FinancialOS pilot pathway fixture — LeadFlow → ConsultationOS → payment → SurgeryOS deposit.
 * Used by unit tests to validate ledger timeline ordering and tenant isolation.
 */
import type { FiFinancialTransactionRow } from "@/src/lib/financialOs/financialTransactionCore";
import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

export const FINANCIAL_OS_PATHWAY_FIXTURE_TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const FINANCIAL_OS_PATHWAY_FIXTURE_LEAD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const FINANCIAL_OS_PATHWAY_FIXTURE_CONSULTATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const FINANCIAL_OS_PATHWAY_FIXTURE_CASE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const FINANCIAL_OS_PATHWAY_FIXTURE_QUOTE_INVOICE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const FINANCIAL_OS_PATHWAY_FIXTURE_DEPOSIT_INVOICE_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const ts = (offsetMinutes: number) =>
  new Date(Date.UTC(2026, 5, 19, 8, 0, offsetMinutes)).toISOString();

export type FinancialOsPathwayFixture = {
  tenantId: string;
  leadId: string;
  consultationId: string;
  caseId: string;
  quoteInvoice: FiInvoiceRow;
  depositInvoice: FiInvoiceRow;
  ledgerTimeline: FiFinancialTransactionRow[];
};

function baseInvoice(partial: Partial<FiInvoiceRow> & Pick<FiInvoiceRow, "id" | "invoice_kind" | "status" | "total_cents">): FiInvoiceRow {
  return {
    tenant_id: FINANCIAL_OS_PATHWAY_FIXTURE_TENANT_ID,
    clinic_id: null,
    patient_id: null,
    lead_id: FINANCIAL_OS_PATHWAY_FIXTURE_LEAD_ID,
    case_id: partial.case_id ?? null,
    consultation_id: partial.consultation_id ?? null,
    amount_cents: partial.total_cents,
    tax_cents: 0,
    amount_paid_cents: partial.amount_paid_cents ?? 0,
    currency: "AUD",
    due_date: "2026-07-01",
    issued_at: ts(0),
    sent_at: ts(5),
    paid_at: partial.paid_at ?? null,
    remaining_balance_cents: partial.remaining_balance_cents ?? partial.total_cents,
    days_overdue: partial.days_overdue ?? 0,
    last_reminder_sent_at: null,
    invoice_number: null,
    title: partial.title ?? null,
    automation_hints: {},
    metadata: {},
    created_at: ts(0),
    updated_at: ts(0),
    ...partial,
  };
}

function ledgerTx(
  partial: Pick<FiFinancialTransactionRow, "id" | "transaction_kind" | "amount_cents" | "created_at"> &
    Partial<FiFinancialTransactionRow>
): FiFinancialTransactionRow {
  return {
    tenant_id: FINANCIAL_OS_PATHWAY_FIXTURE_TENANT_ID,
    clinic_id: null,
    currency: "AUD",
    direction: "credit",
    invoice_id: null,
    payment_id: null,
    payment_reconciliation_id: null,
    patient_id: null,
    lead_id: FINANCIAL_OS_PATHWAY_FIXTURE_LEAD_ID,
    case_id: null,
    consultation_id: null,
    source_module: "leadflow",
    description: null,
    idempotency_key: null,
    metadata: {},
    created_by_fi_user_id: null,
    ...partial,
  };
}

/** One complete pathway with partial deposit payment and ordered ledger timeline. */
export function buildFinancialOsPathwayFixture(): FinancialOsPathwayFixture {
  const quoteTotal = 150_000;
  const depositTotal = 50_000;
  const depositPaid = 20_000;

  const quoteInvoice = baseInvoice({
    id: FINANCIAL_OS_PATHWAY_FIXTURE_QUOTE_INVOICE_ID,
    consultation_id: FINANCIAL_OS_PATHWAY_FIXTURE_CONSULTATION_ID,
    invoice_kind: "consultation_quote",
    status: "paid",
    total_cents: quoteTotal,
    amount_paid_cents: quoteTotal,
    remaining_balance_cents: 0,
    paid_at: ts(30),
    title: "Consultation quote · FUE",
  });

  const depositInvoice = baseInvoice({
    id: FINANCIAL_OS_PATHWAY_FIXTURE_DEPOSIT_INVOICE_ID,
    case_id: FINANCIAL_OS_PATHWAY_FIXTURE_CASE_ID,
    consultation_id: null,
    invoice_kind: "surgery_deposit",
    status: "partially_paid",
    total_cents: depositTotal,
    amount_paid_cents: depositPaid,
    remaining_balance_cents: depositTotal - depositPaid,
    title: "Surgery deposit",
  });

  const ledgerTimeline: FiFinancialTransactionRow[] = [
    ledgerTx({
      id: "tx-001",
      transaction_kind: "invoice_created",
      amount_cents: quoteTotal,
      source_module: "consultation_os",
      consultation_id: FINANCIAL_OS_PATHWAY_FIXTURE_CONSULTATION_ID,
      invoice_id: FINANCIAL_OS_PATHWAY_FIXTURE_QUOTE_INVOICE_ID,
      idempotency_key: `invoice_created:${FINANCIAL_OS_PATHWAY_FIXTURE_QUOTE_INVOICE_ID}`,
      created_at: ts(10),
    }),
    ledgerTx({
      id: "tx-002",
      transaction_kind: "payment_received",
      amount_cents: quoteTotal,
      source_module: "consultation_os",
      consultation_id: FINANCIAL_OS_PATHWAY_FIXTURE_CONSULTATION_ID,
      invoice_id: FINANCIAL_OS_PATHWAY_FIXTURE_QUOTE_INVOICE_ID,
      payment_id: "pay-quote-001",
      idempotency_key: "payment:pay-quote-001",
      created_at: ts(30),
    }),
    ledgerTx({
      id: "tx-003",
      transaction_kind: "invoice_created",
      amount_cents: depositTotal,
      source_module: "surgery_os",
      case_id: FINANCIAL_OS_PATHWAY_FIXTURE_CASE_ID,
      invoice_id: FINANCIAL_OS_PATHWAY_FIXTURE_DEPOSIT_INVOICE_ID,
      idempotency_key: `invoice_created:${FINANCIAL_OS_PATHWAY_FIXTURE_DEPOSIT_INVOICE_ID}`,
      created_at: ts(45),
    }),
    ledgerTx({
      id: "tx-004",
      transaction_kind: "deposit_paid",
      amount_cents: depositPaid,
      source_module: "surgery_os",
      case_id: FINANCIAL_OS_PATHWAY_FIXTURE_CASE_ID,
      invoice_id: FINANCIAL_OS_PATHWAY_FIXTURE_DEPOSIT_INVOICE_ID,
      payment_id: "pay-deposit-001",
      idempotency_key: "payment:pay-deposit-001",
      created_at: ts(60),
    }),
  ];

  return {
    tenantId: FINANCIAL_OS_PATHWAY_FIXTURE_TENANT_ID,
    leadId: FINANCIAL_OS_PATHWAY_FIXTURE_LEAD_ID,
    consultationId: FINANCIAL_OS_PATHWAY_FIXTURE_CONSULTATION_ID,
    caseId: FINANCIAL_OS_PATHWAY_FIXTURE_CASE_ID,
    quoteInvoice,
    depositInvoice,
    ledgerTimeline,
  };
}

export function assertPathwayFixtureInvariants(fixture: FinancialOsPathwayFixture): void {
  const { tenantId, ledgerTimeline } = fixture;
  for (const tx of ledgerTimeline) {
    if (tx.tenant_id !== tenantId) {
      throw new Error(`Cross-tenant ledger row: ${tx.id}`);
    }
  }
  const sorted = [...ledgerTimeline].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const kinds = sorted.map((t) => t.transaction_kind);
  assertTimelineOrder(kinds, [
    "invoice_created",
    "payment_received",
    "invoice_created",
    "deposit_paid",
  ]);
}

function assertTimelineOrder(actual: string[], expected: string[]): void {
  if (actual.length !== expected.length || actual.some((k, i) => k !== expected[i])) {
    throw new Error(`Ledger timeline order mismatch: got [${actual.join(", ")}] expected [${expected.join(", ")}]`);
  }
}
