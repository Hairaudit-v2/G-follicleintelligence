import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  aggregateExpenseCpl,
  defaultCplPeriod,
  type ExpenseCplLeadInput,
  type ExpenseCplSpendInput,
  type ExpenseCplSummary,
} from "@/src/lib/financialOs/expenses/expenseCplCore";
import { ensureExpenseCategoriesForTenant } from "@/src/lib/financialOs/expenses/expenseLoaders.server";

function client(c?: SupabaseClient): SupabaseClient {
  return c ?? supabaseAdmin();
}

function campaignKeyFromLeadMetadata(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, unknown>;
  const candidates = [
    m.campaign_key,
    m.campaign,
    m.campaign_name,
    m.utm_campaign,
    m.source_campaign,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

export async function loadExpenseCplSummary(
  tenantId: string,
  options?: {
    periodStart?: string | null;
    periodEnd?: string | null;
    supabase?: SupabaseClient;
  }
): Promise<ExpenseCplSummary> {
  const tid = tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const db = client(options?.supabase);

  const defaults = defaultCplPeriod();
  const period_start = (options?.periodStart?.trim() || defaults.period_start).slice(0, 10);
  const period_end = (options?.periodEnd?.trim() || defaults.period_end).slice(0, 10);

  const categories = await ensureExpenseCategoriesForTenant(tid, db);
  const codeById = new Map(categories.map((c) => [c.id, c.code]));

  const { data: expenseRows, error: expErr } = await db
    .from("fi_expenses")
    .select("id, amount_cents, expense_date, campaign_key, category_id, status")
    .eq("tenant_id", tid)
    .eq("status", "posted")
    .gte("expense_date", period_start)
    .lte("expense_date", period_end)
    .limit(2000);
  if (expErr) throw new Error(expErr.message);

  const expenses: ExpenseCplSpendInput[] = (expenseRows ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const categoryId = r.category_id != null ? String(r.category_id) : null;
    return {
      expense_id: String(r.id),
      amount_cents: Number(r.amount_cents ?? 0),
      expense_date: String(r.expense_date ?? "").slice(0, 10),
      campaign_key: r.campaign_key != null ? String(r.campaign_key) : null,
      category_code: categoryId ? (codeById.get(categoryId) ?? null) : null,
      status: String(r.status ?? ""),
    };
  });

  // Leads created in period (created_at is timestamptz).
  const startIso = `${period_start}T00:00:00.000Z`;
  const endIso = `${period_end}T23:59:59.999Z`;
  const { data: leadRows, error: leadErr } = await db
    .from("fi_crm_leads")
    .select("id, created_at, metadata")
    .eq("tenant_id", tid)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .limit(5000);
  if (leadErr) throw new Error(leadErr.message);

  const leads: ExpenseCplLeadInput[] = (leadRows ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      lead_id: String(r.id),
      created_at: String(r.created_at ?? ""),
      campaign_key: campaignKeyFromLeadMetadata(r.metadata),
    };
  });

  return aggregateExpenseCpl({ period_start, period_end, expenses, leads });
}
