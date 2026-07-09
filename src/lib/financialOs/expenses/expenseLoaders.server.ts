import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_EXPENSE_CATEGORY_SEEDS } from "@/src/lib/financialOs/expenses/expenseCategories";
import {
  assertExpensesTenantScoped,
  mapExpenseCategoryRow,
  mapExpenseImportLineRow,
  mapExpenseImportRow,
  mapExpenseRow,
  type FiExpenseCategoryRow,
  type FiExpenseImportLineRow,
  type FiExpenseImportRow,
  type FiExpenseRow,
  type FiExpenseStatus,
} from "@/src/lib/financialOs/expenses/expenseTypes";

function client(c?: SupabaseClient): SupabaseClient {
  return c ?? supabaseAdmin();
}

/** Ensure system default categories exist for the tenant; returns active categories. */
export async function ensureExpenseCategoriesForTenant(
  tenantId: string,
  supabase?: SupabaseClient
): Promise<FiExpenseCategoryRow[]> {
  const tid = tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const db = client(supabase);

  const existing = await loadExpenseCategoriesForTenant(tid, db);
  if (existing.length > 0) return existing;

  const rows = DEFAULT_EXPENSE_CATEGORY_SEEDS.map((s) => ({
    tenant_id: tid,
    code: s.code,
    label: s.label,
    sort_order: s.sort_order,
    is_system: true,
    is_active: true,
    metadata: { keywords: s.keywords },
  }));

  const { error } = await db.from("fi_expense_categories").insert(rows);
  if (error) {
    // Concurrent seed race: re-load.
    const again = await loadExpenseCategoriesForTenant(tid, db);
    if (again.length > 0) return again;
    throw new Error(error.message);
  }

  return loadExpenseCategoriesForTenant(tid, db);
}

export async function loadExpenseCategoriesForTenant(
  tenantId: string,
  supabase?: SupabaseClient
): Promise<FiExpenseCategoryRow[]> {
  const tid = tenantId.trim();
  const db = client(supabase);
  const { data, error } = await db
    .from("fi_expense_categories")
    .select("*")
    .eq("tenant_id", tid)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => mapExpenseCategoryRow(r as Record<string, unknown>));
  if (!assertExpensesTenantScoped(rows, tid)) {
    throw new Error("Tenant isolation violation in expense categories.");
  }
  return rows;
}

export type LoadExpensesFilters = {
  status?: FiExpenseStatus | "all" | null;
  categoryId?: string | null;
  limit?: number;
};

export async function loadExpensesForTenant(
  tenantId: string,
  filters?: LoadExpensesFilters,
  supabase?: SupabaseClient
): Promise<FiExpenseRow[]> {
  const tid = tenantId.trim();
  const db = client(supabase);
  const limit = Math.min(Math.max(filters?.limit ?? 200, 1), 500);

  let q = db
    .from("fi_expenses")
    .select(
      "*, fi_expense_categories!fi_expenses_category_id_fkey ( code, label )"
    )
    .eq("tenant_id", tid)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  const status = filters?.status;
  if (status && status !== "all") {
    q = q.eq("status", status);
  }
  if (filters?.categoryId?.trim()) {
    q = q.eq("category_id", filters.categoryId.trim());
  }

  const { data, error } = await q;
  if (error) {
    // Fallback without join if FK name differs in some environments.
    const fallback = await db
      .from("fi_expenses")
      .select("*")
      .eq("tenant_id", tid)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (fallback.error) throw new Error(error.message);
    let rows = (fallback.data ?? []).map((r) => mapExpenseRow(r as Record<string, unknown>));
    if (status && status !== "all") {
      rows = rows.filter((r) => r.status === status);
    }
    if (filters?.categoryId?.trim()) {
      const cid = filters.categoryId.trim();
      rows = rows.filter((r) => r.category_id === cid);
    }
    if (!assertExpensesTenantScoped(rows, tid)) {
      throw new Error("Tenant isolation violation in expenses.");
    }
    return rows;
  }

  const rows = (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const cat = r.fi_expense_categories as { code?: string; label?: string } | null | undefined;
    const mapped = mapExpenseRow(r);
    return {
      ...mapped,
      category_code: cat?.code ?? mapped.category_code ?? null,
      category_label: cat?.label ?? mapped.category_label ?? null,
    };
  });

  if (!assertExpensesTenantScoped(rows, tid)) {
    throw new Error("Tenant isolation violation in expenses.");
  }
  return rows;
}

export async function loadExpenseById(
  tenantId: string,
  expenseId: string,
  supabase?: SupabaseClient
): Promise<FiExpenseRow | null> {
  const tid = tenantId.trim();
  const db = client(supabase);
  const { data, error } = await db
    .from("fi_expenses")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", expenseId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = mapExpenseRow(data as Record<string, unknown>);
  if (row.tenant_id !== tid) throw new Error("Tenant isolation violation.");
  return row;
}

export async function loadExpenseImportsForTenant(
  tenantId: string,
  limit = 50,
  supabase?: SupabaseClient
): Promise<FiExpenseImportRow[]> {
  const tid = tenantId.trim();
  const db = client(supabase);
  const { data, error } = await db
    .from("fi_expense_imports")
    .select("*")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => mapExpenseImportRow(r as Record<string, unknown>));
  if (!assertExpensesTenantScoped(rows, tid)) {
    throw new Error("Tenant isolation violation in expense imports.");
  }
  return rows;
}

export async function loadExpenseImportById(
  tenantId: string,
  importId: string,
  supabase?: SupabaseClient
): Promise<FiExpenseImportRow | null> {
  const tid = tenantId.trim();
  const db = client(supabase);
  const { data, error } = await db
    .from("fi_expense_imports")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", importId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = mapExpenseImportRow(data as Record<string, unknown>);
  if (row.tenant_id !== tid) throw new Error("Tenant isolation violation.");
  return row;
}

export async function loadExpenseImportLines(
  tenantId: string,
  importId: string,
  supabase?: SupabaseClient
): Promise<FiExpenseImportLineRow[]> {
  const tid = tenantId.trim();
  const db = client(supabase);
  const { data, error } = await db
    .from("fi_expense_import_lines")
    .select("*")
    .eq("tenant_id", tid)
    .eq("import_id", importId.trim())
    .order("line_index", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => mapExpenseImportLineRow(r as Record<string, unknown>));
  if (!assertExpensesTenantScoped(rows, tid)) {
    throw new Error("Tenant isolation violation in expense import lines.");
  }
  return rows;
}

export function categoryCodeToIdMap(
  categories: readonly FiExpenseCategoryRow[]
): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of categories) {
    m.set(c.code.trim().toLowerCase(), c.id);
  }
  return m;
}
