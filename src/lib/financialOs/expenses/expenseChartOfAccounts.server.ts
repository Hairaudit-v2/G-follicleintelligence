import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  DEFAULT_GL_ACCOUNT_SEEDS,
  aggregateMultiClinicOperatingPl,
  type ClinicPlSummary,
} from "@/src/lib/financialOs/expenses/expenseChartOfAccountsCore";
import { ensureExpenseCategoriesForTenant } from "@/src/lib/financialOs/expenses/expenseLoaders.server";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";

function client(c?: SupabaseClient): SupabaseClient {
  return c ?? supabaseAdmin();
}

export type FiGlAccountRow = {
  id: string;
  tenant_id: string;
  clinic_id: string | null;
  code: string;
  name: string;
  account_type: string;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
};

function mapGl(raw: Record<string, unknown>): FiGlAccountRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    code: String(raw.code ?? ""),
    name: String(raw.name ?? ""),
    account_type: String(raw.account_type ?? "expense"),
    is_system: Boolean(raw.is_system),
    is_active: raw.is_active !== false,
    sort_order: Number(raw.sort_order ?? 0),
  };
}

export async function ensureGlAccountsForTenant(
  tenantId: string,
  supabase?: SupabaseClient
): Promise<FiGlAccountRow[]> {
  const tid = tenantId.trim();
  const db = client(supabase);

  const { data: existing, error } = await db
    .from("fi_expense_gl_accounts")
    .select("*")
    .eq("tenant_id", tid)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  if ((existing ?? []).length > 0) {
    return (existing ?? []).map((r) => mapGl(r as Record<string, unknown>));
  }

  const rows = DEFAULT_GL_ACCOUNT_SEEDS.map((s) => ({
    tenant_id: tid,
    code: s.code,
    name: s.name,
    account_type: s.account_type,
    is_system: true,
    is_active: true,
    sort_order: s.sort_order,
    metadata: { category_codes: s.category_codes },
  }));

  const { error: insErr } = await db.from("fi_expense_gl_accounts").insert(rows);
  if (insErr) {
    // Concurrent seed race — re-read.
  }

  const { data: seeded, error: seedErr } = await db
    .from("fi_expense_gl_accounts")
    .select("*")
    .eq("tenant_id", tid)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (seedErr) throw new Error(seedErr.message);
  const accounts = (seeded ?? []).map((r) => mapGl(r as Record<string, unknown>));

  // Best-effort: map expense categories to GL accounts by seed metadata.
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  try {
    const categories = await ensureExpenseCategoriesForTenant(tid, db);
    for (const cat of categories) {
      const seed = DEFAULT_GL_ACCOUNT_SEEDS.find((s) =>
        s.category_codes.includes(cat.code.toLowerCase())
      );
      const glId = seed ? byCode.get(seed.code) : byCode.get("6900");
      if (!glId) continue;
      await db
        .from("fi_expense_categories")
        .update({ gl_account_id: glId })
        .eq("tenant_id", tid)
        .eq("id", cat.id)
        .is("gl_account_id", null);
    }
  } catch {
    // Category mapping is optional if categories table unavailable.
  }

  return accounts;
}

export async function loadMultiClinicOperatingPl(
  tenantId: string,
  options?: { periodStart?: string | null; periodEnd?: string | null; supabase?: SupabaseClient }
): Promise<ClinicPlSummary> {
  const tid = tenantId.trim();
  const db = client(options?.supabase);
  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: options?.periodStart,
    periodEnd: options?.periodEnd,
  });

  const [{ data: clinics }, { data: ledger, error }] = await Promise.all([
    db.from("fi_clinics").select("id, name").eq("tenant_id", tid).order("name").limit(100),
    db
      .from("fi_financial_transactions")
      .select("clinic_id, transaction_kind, direction, amount_cents, created_at")
      .eq("tenant_id", tid)
      .gte("created_at", `${period_start}T00:00:00.000Z`)
      .lte("created_at", `${period_end}T23:59:59.999Z`)
      .limit(15000),
  ]);
  if (error) throw new Error(error.message);

  const clinicNames = new Map<string, string>();
  for (const c of clinics ?? []) {
    const r = c as { id: string; name: string | null };
    clinicNames.set(String(r.id), String(r.name ?? r.id));
  }

  return aggregateMultiClinicOperatingPl({
    period_start,
    period_end,
    clinicNames,
    ledger: (ledger ?? []).map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        clinic_id: r.clinic_id != null ? String(r.clinic_id) : null,
        transaction_kind: String(r.transaction_kind ?? ""),
        direction: String(r.direction ?? "credit"),
        amount_cents: Number(r.amount_cents ?? 0),
        created_at: String(r.created_at ?? ""),
      };
    }),
  });
}
