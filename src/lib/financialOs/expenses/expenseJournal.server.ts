import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureGlAccountsForTenant } from "@/src/lib/financialOs/expenses/expenseChartOfAccounts.server";
import { defaultGlCodeForCategoryCode } from "@/src/lib/financialOs/expenses/expenseChartOfAccountsCore";
import {
  buildExpensePostJournal,
  buildExpenseVoidJournal,
  fundingGlForPaymentMethod,
  type JournalEntryDraft,
} from "@/src/lib/financialOs/expenses/expenseJournalCore";
import type { FiExpenseRow } from "@/src/lib/financialOs/expenses/expenseTypes";
import { ensureExpenseCategoriesForTenant } from "@/src/lib/financialOs/expenses/expenseLoaders.server";

function client(c?: SupabaseClient): SupabaseClient {
  return c ?? supabaseAdmin();
}

async function resolveExpenseAndFundingGl(
  expense: FiExpenseRow,
  db: SupabaseClient
): Promise<{
  expense_gl: { code: string; name: string; id: string | null };
  funding_gl: { code: string; name: string; id: string | null };
}> {
  const accounts = await ensureGlAccountsForTenant(expense.tenant_id, db);
  const byCode = new Map(accounts.map((a) => [a.code, a]));

  // Ensure cash/AP system accounts exist in memory map (may need insert).
  const ensureCode = async (code: string, name: string, account_type: string) => {
    if (byCode.has(code)) return;
    const { data } = await db
      .from("fi_expense_gl_accounts")
      .insert({
        tenant_id: expense.tenant_id,
        code,
        name,
        account_type,
        is_system: true,
        is_active: true,
        sort_order: code === "1000" ? 1 : 2,
      })
      .select("*")
      .maybeSingle();
    if (data) {
      const a = data as { id: string; code: string; name: string };
      byCode.set(a.code, {
        id: a.id,
        tenant_id: expense.tenant_id,
        clinic_id: null,
        code: a.code,
        name: a.name,
        account_type,
        is_system: true,
        is_active: true,
        sort_order: 0,
      });
    }
  };
  await ensureCode("1000", "Cash & bank", "asset");
  await ensureCode("2000", "Accounts payable", "liability");

  let expenseCode = "6900";
  if (expense.category_id) {
    const cats = await ensureExpenseCategoriesForTenant(expense.tenant_id, db);
    const cat = cats.find((c) => c.id === expense.category_id);
    if (cat?.code) expenseCode = defaultGlCodeForCategoryCode(cat.code);
  }
  const expAcc = byCode.get(expenseCode) ?? byCode.get("6900")!;
  const funding = fundingGlForPaymentMethod(expense.payment_method);
  const fundAcc = byCode.get(funding.code) ?? byCode.get("2000")!;

  return {
    expense_gl: { code: expAcc.code, name: expAcc.name, id: expAcc.id },
    funding_gl: { code: fundAcc.code, name: fundAcc.name, id: fundAcc.id },
  };
}

async function persistJournal(input: {
  tenantId: string;
  expenseId: string;
  clinicId: string | null;
  draft: JournalEntryDraft;
  idempotencyKey: string;
  actorFiUserId?: string | null;
  supabase: SupabaseClient;
}): Promise<string | null> {
  if (!input.draft.balanced || input.draft.total_debit_cents <= 0) return null;
  const db = input.supabase;
  const tid = input.tenantId;

  const { data: existing } = await db
    .from("fi_expense_journal_entries")
    .select("id")
    .eq("tenant_id", tid)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing) return String((existing as { id: string }).id);

  const { data: header, error } = await db
    .from("fi_expense_journal_entries")
    .insert({
      tenant_id: tid,
      clinic_id: input.clinicId,
      expense_id: input.expenseId,
      entry_date: input.draft.entry_date,
      memo: input.draft.memo,
      source: input.draft.source,
      status: "posted",
      currency: input.draft.currency,
      total_debit_cents: input.draft.total_debit_cents,
      total_credit_cents: input.draft.total_credit_cents,
      idempotency_key: input.idempotencyKey,
      created_by_fi_user_id: input.actorFiUserId ?? null,
      metadata: {},
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: dup } = await db
        .from("fi_expense_journal_entries")
        .select("id")
        .eq("tenant_id", tid)
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      return dup ? String((dup as { id: string }).id) : null;
    }
    throw new Error(error.message);
  }
  const entryId = String((header as { id: string }).id);

  const lineRows = input.draft.lines.map((l) => ({
    tenant_id: tid,
    journal_entry_id: entryId,
    gl_account_id: l.gl_account_id ?? null,
    gl_account_code: l.gl_account_code,
    gl_account_name: l.gl_account_name,
    side: l.side,
    amount_cents: l.amount_cents,
    line_memo: l.line_memo ?? null,
    sort_order: l.sort_order,
    metadata: {},
  }));
  const { error: lineErr } = await db.from("fi_expense_journal_lines").insert(lineRows);
  if (lineErr) throw new Error(lineErr.message);
  return entryId;
}

export async function postExpenseJournalForExpense(input: {
  expense: FiExpenseRow;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<string | null> {
  const db = client(input.supabase);
  const exp = input.expense;
  if (exp.amount_cents <= 0) return null;
  const gl = await resolveExpenseAndFundingGl(exp, db);
  const draft = buildExpensePostJournal({
    expense_date: exp.expense_date,
    amount_cents: exp.amount_cents,
    currency: exp.currency,
    expense_gl: gl.expense_gl,
    funding_gl: gl.funding_gl,
    memo: exp.description || exp.vendor_name || `Expense ${exp.id.slice(0, 8)}`,
  });
  const entryId = await persistJournal({
    tenantId: exp.tenant_id,
    expenseId: exp.id,
    clinicId: exp.clinic_id,
    draft,
    idempotencyKey: `tenant:${exp.tenant_id}:journal_post:${exp.id}`,
    actorFiUserId: input.actorFiUserId,
    supabase: db,
  });
  if (entryId) {
    await db
      .from("fi_expenses")
      .update({ journal_entry_id: entryId })
      .eq("tenant_id", exp.tenant_id)
      .eq("id", exp.id);
  }
  return entryId;
}

export async function postExpenseVoidJournalForExpense(input: {
  expense: FiExpenseRow;
  actorFiUserId?: string | null;
  reason?: string | null;
  supabase?: SupabaseClient;
}): Promise<string | null> {
  const db = client(input.supabase);
  const exp = input.expense;
  if (exp.amount_cents <= 0) return null;
  const gl = await resolveExpenseAndFundingGl(exp, db);
  const draft = buildExpenseVoidJournal({
    expense_date: exp.expense_date,
    amount_cents: exp.amount_cents,
    currency: exp.currency,
    expense_gl: gl.expense_gl,
    funding_gl: gl.funding_gl,
    memo: input.reason || `Void ${exp.id.slice(0, 8)}`,
  });
  const entryId = await persistJournal({
    tenantId: exp.tenant_id,
    expenseId: exp.id,
    clinicId: exp.clinic_id,
    draft,
    idempotencyKey: `tenant:${exp.tenant_id}:journal_void:${exp.id}`,
    actorFiUserId: input.actorFiUserId,
    supabase: db,
  });
  if (entryId) {
    await db
      .from("fi_expenses")
      .update({ journal_void_entry_id: entryId })
      .eq("tenant_id", exp.tenant_id)
      .eq("id", exp.id);
  }
  return entryId;
}
