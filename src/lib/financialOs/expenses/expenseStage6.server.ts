import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  matchBankLinesToExpenses,
  type BankReconResult,
} from "@/src/lib/financialOs/expenses/expenseBankReconCore";
import {
  buildExpensesCsv,
  buildQuickBooksExpenseCsv,
  buildQuickBooksPurchaseDrafts,
  type ExpenseExportRow,
  type QuickBooksPurchaseDraft,
} from "@/src/lib/financialOs/expenses/expenseExportCore";
import { ensureExpenseCategoriesForTenant } from "@/src/lib/financialOs/expenses/expenseLoaders.server";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { aggregateOperatingPl, type ExpensePlSummary } from "@/src/lib/financialOs/expenses/expensePlCore";

function client(c?: SupabaseClient): SupabaseClient {
  return c ?? supabaseAdmin();
}

async function loadPostedExpensesForExport(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  db: SupabaseClient
): Promise<ExpenseExportRow[]> {
  const tid = tenantId.trim();
  const categories = await ensureExpenseCategoriesForTenant(tid, db);
  const codeById = new Map(categories.map((c) => [c.id, c.code]));
  const labelById = new Map(categories.map((c) => [c.id, c.label]));

  const { data, error } = await db
    .from("fi_expenses")
    .select(
      "id, expense_date, amount_cents, currency, status, vendor_name, description, category_id, campaign_key, lead_id, case_id, procedure_type, payment_method, ledger_post_transaction_id, source_import_line_id"
    )
    .eq("tenant_id", tid)
    .gte("expense_date", periodStart)
    .lte("expense_date", periodEnd)
    .order("expense_date", { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message);

  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const categoryId = r.category_id != null ? String(r.category_id) : null;
    return {
      id: String(r.id),
      expense_date: String(r.expense_date ?? "").slice(0, 10),
      amount_cents: Number(r.amount_cents ?? 0),
      currency: String(r.currency ?? "AUD"),
      status: String(r.status ?? ""),
      vendor_name: r.vendor_name != null ? String(r.vendor_name) : null,
      description: r.description != null ? String(r.description) : null,
      category_code: categoryId ? (codeById.get(categoryId) ?? null) : null,
      category_label: categoryId ? (labelById.get(categoryId) ?? null) : null,
      campaign_key: r.campaign_key != null ? String(r.campaign_key) : null,
      lead_id: r.lead_id != null ? String(r.lead_id) : null,
      case_id: r.case_id != null ? String(r.case_id) : null,
      procedure_type: r.procedure_type != null ? String(r.procedure_type) : null,
      payment_method: r.payment_method != null ? String(r.payment_method) : null,
      ledger_post_transaction_id:
        r.ledger_post_transaction_id != null ? String(r.ledger_post_transaction_id) : null,
    };
  });
}

export async function loadOperatingPlSummary(
  tenantId: string,
  options?: { periodStart?: string | null; periodEnd?: string | null; supabase?: SupabaseClient }
): Promise<ExpensePlSummary> {
  const tid = tenantId.trim();
  const db = client(options?.supabase);
  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: options?.periodStart,
    periodEnd: options?.periodEnd,
  });

  const { data, error } = await db
    .from("fi_financial_transactions")
    .select("transaction_kind, direction, amount_cents, created_at")
    .eq("tenant_id", tid)
    .gte("created_at", `${period_start}T00:00:00.000Z`)
    .lte("created_at", `${period_end}T23:59:59.999Z`)
    .limit(10000);
  if (error) throw new Error(error.message);

  return aggregateOperatingPl({
    period_start,
    period_end,
    ledger: (data ?? []).map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        transaction_kind: String(r.transaction_kind ?? ""),
        direction: String(r.direction ?? "credit"),
        amount_cents: Number(r.amount_cents ?? 0),
        created_at: String(r.created_at ?? ""),
      };
    }),
  });
}

export async function buildExpensePeriodExports(
  tenantId: string,
  options?: { periodStart?: string | null; periodEnd?: string | null; supabase?: SupabaseClient }
): Promise<{
  period_start: string;
  period_end: string;
  fi_csv: string;
  quickbooks_csv: string;
  quickbooks_drafts: QuickBooksPurchaseDraft[];
  row_count: number;
  posted_count: number;
}> {
  const tid = tenantId.trim();
  const db = client(options?.supabase);
  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: options?.periodStart,
    periodEnd: options?.periodEnd,
  });
  const rows = await loadPostedExpensesForExport(tid, period_start, period_end, db);
  const posted = rows.filter((r) => r.status === "posted");
  return {
    period_start,
    period_end,
    fi_csv: buildExpensesCsv(rows),
    quickbooks_csv: buildQuickBooksExpenseCsv(posted),
    quickbooks_drafts: buildQuickBooksPurchaseDrafts(posted),
    row_count: rows.length,
    posted_count: posted.length,
  };
}

export async function loadBankReconciliationPreview(
  tenantId: string,
  options?: { periodStart?: string | null; periodEnd?: string | null; supabase?: SupabaseClient }
): Promise<
  BankReconResult & {
    period_start: string;
    period_end: string;
    line_count: number;
    expense_count: number;
  }
> {
  const tid = tenantId.trim();
  const db = client(options?.supabase);
  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: options?.periodStart,
    periodEnd: options?.periodEnd,
  });

  const { data: lines, error: lineErr } = await db
    .from("fi_expense_import_lines")
    .select(
      "id, transaction_date, amount_cents, external_ref, description_raw, vendor_name, status"
    )
    .eq("tenant_id", tid)
    .gte("transaction_date", period_start)
    .lte("transaction_date", period_end)
    .limit(2000);
  if (lineErr) throw new Error(lineErr.message);

  const { data: expenses, error: expErr } = await db
    .from("fi_expenses")
    .select(
      "id, expense_date, amount_cents, vendor_name, description, status, source_import_line_id"
    )
    .eq("tenant_id", tid)
    .gte("expense_date", period_start)
    .lte("expense_date", period_end)
    .limit(2000);
  if (expErr) throw new Error(expErr.message);

  const recon = matchBankLinesToExpenses({
    lines: (lines ?? []).map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        id: String(r.id),
        transaction_date: r.transaction_date != null ? String(r.transaction_date).slice(0, 10) : null,
        amount_cents: Number(r.amount_cents ?? 0),
        external_ref: r.external_ref != null ? String(r.external_ref) : null,
        description_raw: r.description_raw != null ? String(r.description_raw) : null,
        vendor_name: r.vendor_name != null ? String(r.vendor_name) : null,
        status: String(r.status ?? ""),
      };
    }),
    expenses: (expenses ?? []).map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        id: String(r.id),
        expense_date: String(r.expense_date ?? "").slice(0, 10),
        amount_cents: Number(r.amount_cents ?? 0),
        vendor_name: r.vendor_name != null ? String(r.vendor_name) : null,
        description: r.description != null ? String(r.description) : null,
        status: String(r.status ?? ""),
        source_import_line_id:
          r.source_import_line_id != null ? String(r.source_import_line_id) : null,
      };
    }),
  });

  return {
    ...recon,
    period_start,
    period_end,
    line_count: lines?.length ?? 0,
    expense_count: expenses?.length ?? 0,
  };
}
