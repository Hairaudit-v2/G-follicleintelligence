import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ledgerKindForInvoice,
  mapFinancialTransactionRow,
  sourceModuleForInvoice,
  type FiFinancialSourceModule,
  type FiFinancialTransactionKind,
  type FiFinancialTransactionRow,
} from "@/src/lib/financialOs/financialTransactionCore";
import { validateLedgerAppendInput } from "@/src/lib/financialOs/financialLedgerInvariantsCore";
import type { FiInvoiceKind, FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type AppendFinancialTransactionArgs = {
  tenantId: string;
  clinicId?: string | null;
  transactionKind: FiFinancialTransactionKind;
  amountCents: number;
  currency?: string;
  direction?: "credit" | "debit";
  invoiceId?: string | null;
  paymentId?: string | null;
  paymentReconciliationId?: string | null;
  patientId?: string | null;
  leadId?: string | null;
  caseId?: string | null;
  consultationId?: string | null;
  sourceModule?: FiFinancialSourceModule;
  description?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
  createdByFiUserId?: string | null;
};

/**
 * Append-only master ledger write with mandatory audit event.
 * Idempotent when idempotencyKey is provided and already exists.
 */
export async function appendFinancialTransaction(args: AppendFinancialTransactionArgs): Promise<FiFinancialTransactionRow | null> {
  const tid = args.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");

  const validated = validateLedgerAppendInput({
    tenantId: tid,
    amountCents: args.amountCents,
    direction: args.direction,
    transactionKind: args.transactionKind,
    idempotencyKey: args.idempotencyKey,
    anchorTenantId: tid,
  });
  if (!validated.ok) throw new Error(validated.message);
  const amount = validated.normalizedAmountCents;

  const supabase = supabaseAdmin();
  const idempotencyKey = args.idempotencyKey?.trim() || null;

  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("fi_financial_transactions")
      .select("*")
      .eq("tenant_id", tid)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) return mapFinancialTransactionRow(existing as Record<string, unknown>);
  }

  const insert = {
    tenant_id: tid,
    clinic_id: args.clinicId?.trim() || null,
    transaction_kind: args.transactionKind,
    amount_cents: amount,
    currency: (args.currency ?? "AUD").trim().toUpperCase() || "AUD",
    direction: validated.direction,
    invoice_id: args.invoiceId?.trim() || null,
    payment_id: args.paymentId?.trim() || null,
    payment_reconciliation_id: args.paymentReconciliationId?.trim() || null,
    patient_id: args.patientId?.trim() || null,
    lead_id: args.leadId?.trim() || null,
    case_id: args.caseId?.trim() || null,
    consultation_id: args.consultationId?.trim() || null,
    source_module: args.sourceModule ?? "financial_os",
    description: args.description?.trim() || null,
    idempotency_key: idempotencyKey,
    metadata: args.metadata ?? {},
    created_by_fi_user_id: args.createdByFiUserId?.trim() || null,
  };

  const { data, error } = await supabase.from("fi_financial_transactions").insert(insert).select("*").single();
  if (error) {
    if (idempotencyKey && error.code === "23505") {
      const { data: dup } = await supabase
        .from("fi_financial_transactions")
        .select("*")
        .eq("tenant_id", tid)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (dup) return mapFinancialTransactionRow(dup as Record<string, unknown>);
    }
    throw new Error(error.message);
  }

  const row = mapFinancialTransactionRow(data as Record<string, unknown>);

  const { error: auditErr } = await supabase.from("fi_financial_transaction_audit_events").insert({
    tenant_id: tid,
    financial_transaction_id: row.id,
    event_kind: "ledger_appended",
    actor_fi_user_id: args.createdByFiUserId?.trim() || null,
    payload: {
      transaction_kind: row.transaction_kind,
      amount_cents: row.amount_cents,
      currency: row.currency,
      direction: row.direction,
      invoice_id: row.invoice_id,
      payment_id: row.payment_id,
      source_module: row.source_module,
    },
  });
  if (auditErr) throw new Error(auditErr.message);

  return row;
}

export async function appendInvoiceCreatedLedgerEntry(args: {
  invoice: FiInvoiceRow;
  createdByFiUserId?: string | null;
}): Promise<void> {
  const inv = args.invoice;
  if (inv.total_cents <= 0) return;
  try {
    await appendFinancialTransaction({
      tenantId: inv.tenant_id,
      clinicId: inv.clinic_id,
      transactionKind: "invoice_created",
      amountCents: inv.total_cents,
      currency: inv.currency,
      direction: "credit",
      invoiceId: inv.id,
      patientId: inv.patient_id,
      leadId: inv.lead_id,
      caseId: inv.case_id,
      consultationId: inv.consultation_id,
      sourceModule: sourceModuleForInvoice(inv),
      description: inv.title ?? `Invoice ${inv.invoice_kind}`,
      idempotencyKey: `invoice_created:${inv.id}`,
      metadata: { invoice_kind: inv.invoice_kind, invoice_status: inv.status },
      createdByFiUserId: args.createdByFiUserId ?? null,
    });
  } catch {
    /* ledger is best-effort on create to avoid blocking RevenueOS */
  }
}

export async function appendPaymentReceivedLedgerEntry(args: {
  invoice: FiInvoiceRow;
  paymentId: string;
  amountCents: number;
  currency: string;
  createdByFiUserId?: string | null;
  paymentReconciliationId?: string | null;
}): Promise<void> {
  const inv = args.invoice;
  const kind = ledgerKindForInvoice(inv.invoice_kind);
  try {
    await appendFinancialTransaction({
      tenantId: inv.tenant_id,
      clinicId: inv.clinic_id,
      transactionKind: kind,
      amountCents: args.amountCents,
      currency: args.currency,
      direction: "credit",
      invoiceId: inv.id,
      paymentId: args.paymentId,
      paymentReconciliationId: args.paymentReconciliationId ?? null,
      patientId: inv.patient_id,
      leadId: inv.lead_id,
      caseId: inv.case_id,
      consultationId: inv.consultation_id,
      sourceModule: sourceModuleForInvoice(inv),
      description: `Payment · ${inv.invoice_kind}`,
      idempotencyKey: `payment:${args.paymentId}`,
      metadata: { invoice_kind: inv.invoice_kind },
      createdByFiUserId: args.createdByFiUserId ?? null,
    });
  } catch {
    /* best-effort */
  }
}

export async function appendCancellationFeeLedgerEntry(args: {
  tenantId: string;
  invoiceId: string;
  amountCents: number;
  currency: string;
  patientId?: string | null;
  leadId?: string | null;
  caseId?: string | null;
  description?: string;
  idempotencyKey: string;
}): Promise<void> {
  try {
    await appendFinancialTransaction({
      tenantId: args.tenantId,
      transactionKind: "cancellation_fee",
      amountCents: args.amountCents,
      currency: args.currency,
      direction: "credit",
      invoiceId: args.invoiceId,
      patientId: args.patientId ?? null,
      leadId: args.leadId ?? null,
      caseId: args.caseId ?? null,
      sourceModule: "financial_os",
      description: args.description ?? "Cancellation fee",
      idempotencyKey: args.idempotencyKey,
    });
  } catch {
    /* best-effort */
  }
}

export function paymentKindLabel(invoiceKind: FiInvoiceKind): FiFinancialTransactionKind {
  return ledgerKindForInvoice(invoiceKind);
}
