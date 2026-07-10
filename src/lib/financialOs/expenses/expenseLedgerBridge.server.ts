import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { appendFinancialTransaction } from "@/src/lib/financialOs/financialTransactionLedger.server";
import type { FiExpenseRow } from "@/src/lib/financialOs/expenses/expenseTypes";

/**
 * Append expense_posted debit to the master ledger (idempotent).
 * Returns transaction id or null when amount is zero (no ledger row).
 */
export async function appendExpensePostedLedgerEntry(input: {
  expense: FiExpenseRow;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<string | null> {
  const exp = input.expense;
  if (exp.amount_cents <= 0) return null;

  const idempotencyKey = `tenant:${exp.tenant_id}:expense_posted:${exp.id}`;
  const row = await appendFinancialTransaction({
    tenantId: exp.tenant_id,
    clinicId: exp.clinic_id,
    transactionKind: "expense_posted",
    amountCents: exp.amount_cents,
    currency: exp.currency,
    direction: "debit",
    patientId: exp.patient_id,
    leadId: exp.lead_id,
    caseId: exp.case_id,
    consultationId: exp.consultation_id,
    sourceModule: "financial_os",
    description:
      exp.description?.trim() ||
      exp.vendor_name?.trim() ||
      `Expense ${exp.id.slice(0, 8)}`,
    idempotencyKey,
    metadata: {
      expense_id: exp.id,
      category_id: exp.category_id,
      campaign_key: exp.campaign_key,
      vendor_name: exp.vendor_name,
      expense_date: exp.expense_date,
    },
    createdByFiUserId: input.actorFiUserId,
  });

  return row?.id ?? null;
}

/**
 * Compensating credit when a posted expense is voided (idempotent).
 */
export async function appendExpenseVoidReversalLedgerEntry(input: {
  expense: FiExpenseRow;
  actorFiUserId?: string | null;
  reason?: string | null;
  supabase?: SupabaseClient;
}): Promise<string | null> {
  const exp = input.expense;
  if (exp.amount_cents <= 0) return null;
  // Only reverse if it was posted (or has a post ledger id / was posted before void).
  if (exp.status !== "void" && exp.status !== "posted") return null;

  const idempotencyKey = `tenant:${exp.tenant_id}:expense_void_reversal:${exp.id}`;
  const row = await appendFinancialTransaction({
    tenantId: exp.tenant_id,
    clinicId: exp.clinic_id,
    transactionKind: "expense_void_reversal",
    amountCents: exp.amount_cents,
    currency: exp.currency,
    direction: "credit",
    patientId: exp.patient_id,
    leadId: exp.lead_id,
    caseId: exp.case_id,
    consultationId: exp.consultation_id,
    sourceModule: "financial_os",
    description: `Void expense ${exp.id.slice(0, 8)}${
      input.reason?.trim() ? `: ${input.reason.trim()}` : ""
    }`,
    idempotencyKey,
    metadata: {
      expense_id: exp.id,
      category_id: exp.category_id,
      campaign_key: exp.campaign_key,
      vendor_name: exp.vendor_name,
      void_reason: input.reason?.trim() || null,
      reverses: "expense_posted",
    },
    createdByFiUserId: input.actorFiUserId,
  });

  return row?.id ?? null;
}
