import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import {
  aggregateExpenseCostPerGraft,
  type ExpenseCpgGraftInput,
  type ExpenseCpgSpendInput,
  type ExpenseCpgStandardModel,
  type ExpenseCpgSummary,
} from "@/src/lib/financialOs/expenses/expenseCostPerGraftCore";
import { loadExpenseCplSummary } from "@/src/lib/financialOs/expenses/expenseCpl.server";
import type { ExpenseCplSummary } from "@/src/lib/financialOs/expenses/expenseCplCore";
import { ensureExpenseCategoriesForTenant } from "@/src/lib/financialOs/expenses/expenseLoaders.server";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import {
  aggregateExpenseSpendByCategory,
  type ExpenseSpendSummary,
} from "@/src/lib/financialOs/expenses/expenseSpendSummaryCore";
import type { FiExpenseRow } from "@/src/lib/financialOs/expenses/expenseTypes";
import { calculateSurgeryProfitability } from "@/src/lib/financialOs/financialSurgeryEconomicsCore";
import { loadSurgeryCostModelsForTenant } from "@/src/lib/financialOs/financialSurgeryCostModel.server";

function client(c?: SupabaseClient): SupabaseClient {
  return c ?? supabaseAdmin();
}

export type ExpenseIntelligenceBundle = {
  period_start: string;
  period_end: string;
  cpl: ExpenseCplSummary;
  spend: ExpenseSpendSummary;
  costPerGraft: ExpenseCpgSummary;
};

export async function loadExpenseIntelligenceBundle(
  tenantId: string,
  options?: {
    periodStart?: string | null;
    periodEnd?: string | null;
    supabase?: SupabaseClient;
  }
): Promise<ExpenseIntelligenceBundle> {
  const tid = tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const db = client(options?.supabase);
  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: options?.periodStart,
    periodEnd: options?.periodEnd,
  });

  const categories = await ensureExpenseCategoriesForTenant(tid, db);
  const codeById = new Map(categories.map((c) => [c.id, c.code]));
  const labelById = new Map(categories.map((c) => [c.id, c.label]));

  const { data: expenseRows, error: expErr } = await db
    .from("fi_expenses")
    .select(
      "id, amount_cents, expense_date, campaign_key, category_id, status, case_id, procedure_type"
    )
    .eq("tenant_id", tid)
    .eq("status", "posted")
    .gte("expense_date", period_start)
    .lte("expense_date", period_end)
    .limit(3000);
  if (expErr) throw new Error(expErr.message);

  const spendInputs = (expenseRows ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const categoryId = r.category_id != null ? String(r.category_id) : null;
    return {
      amount_cents: Number(r.amount_cents ?? 0),
      expense_date: String(r.expense_date ?? "").slice(0, 10),
      status: String(r.status ?? ""),
      category_code: categoryId ? (codeById.get(categoryId) ?? null) : null,
      category_label: categoryId ? (labelById.get(categoryId) ?? null) : null,
    };
  });

  const cpgExpenses: ExpenseCpgSpendInput[] = (expenseRows ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const categoryId = r.category_id != null ? String(r.category_id) : null;
    return {
      expense_id: String(r.id),
      amount_cents: Number(r.amount_cents ?? 0),
      expense_date: String(r.expense_date ?? "").slice(0, 10),
      status: String(r.status ?? ""),
      category_code: categoryId ? (codeById.get(categoryId) ?? null) : null,
      case_id: r.case_id != null ? String(r.case_id) : null,
      procedure_type: r.procedure_type != null ? String(r.procedure_type) : null,
    };
  });

  // Procedure-day graft rows in period (tenant-scoped).
  const { data: procRows, error: procErr } = await db
    .from("fi_case_procedures")
    .select("case_id, procedure_date, grafts_implanted, tenant_id")
    .eq("tenant_id", tid)
    .gte("procedure_date", period_start)
    .lte("procedure_date", period_end)
    .not("grafts_implanted", "is", null)
    .limit(2000);
  if (procErr) {
    // Soft-fail: some environments may lack procedure-day rows; CPG falls back to snapshots.
  }

  const caseIds = [
    ...new Set(
      (procRows ?? []).map((r) => String((r as { case_id?: string }).case_id ?? "")).filter(Boolean)
    ),
  ];

  // Resolve procedure_type from cases or surgery plans / cost model usage.
  const caseProcType = new Map<string, string | null>();
  if (caseIds.length > 0) {
    const { data: cases, error: caseErr } = await db
      .from("fi_cases")
      .select("id, treatment_type, metadata")
      .eq("tenant_id", tid)
      .in("id", caseIds.slice(0, 500));
    if (!caseErr && cases) {
      for (const raw of cases) {
        const r = raw as {
          id: string;
          treatment_type?: string | null;
          metadata?: Record<string, unknown> | null;
        };
        const meta = r.metadata && typeof r.metadata === "object" ? r.metadata : {};
        const fromMeta = typeof meta.procedure_type === "string" ? meta.procedure_type : null;
        caseProcType.set(
          r.id,
          (r.treatment_type?.trim() || fromMeta?.trim() || null)?.toLowerCase() ?? null
        );
      }
    }
  }

  const graftRows: ExpenseCpgGraftInput[] = (procRows ?? []).map((raw) => {
    const r = raw as {
      case_id: string;
      procedure_date: string | null;
      grafts_implanted: number | null;
    };
    return {
      case_id: String(r.case_id),
      procedure_type: caseProcType.get(String(r.case_id)) ?? null,
      grafts_implanted: r.grafts_implanted != null ? Number(r.grafts_implanted) : null,
      procedure_date: r.procedure_date != null ? String(r.procedure_date).slice(0, 10) : null,
    };
  });

  // Also use profitability snapshots in period when procedure-day missing.
  if (graftRows.length === 0) {
    const { data: snaps } = await db
      .from("fi_surgery_profitability_snapshots")
      .select("case_id, procedure_type, graft_count, calculated_at")
      .eq("tenant_id", tid)
      .gte("calculated_at", `${period_start}T00:00:00.000Z`)
      .lte("calculated_at", `${period_end}T23:59:59.999Z`)
      .limit(500);
    for (const raw of snaps ?? []) {
      const r = raw as {
        case_id: string | null;
        procedure_type: string | null;
        graft_count: number | null;
        calculated_at: string;
      };
      if (!r.case_id || r.graft_count == null) continue;
      graftRows.push({
        case_id: String(r.case_id),
        procedure_type: r.procedure_type?.trim().toLowerCase() || null,
        grafts_implanted: Number(r.graft_count),
        procedure_date: String(r.calculated_at).slice(0, 10),
      });
    }
  }

  let standards: ExpenseCpgStandardModel[] = [];
  try {
    const models = await loadSurgeryCostModelsForTenant(tid, db);
    const REF_GRAFTS = 2000;
    standards = models
      .filter((m) => m.is_active)
      .map((m) => {
        // Stage 8: full-model standard CPG at reference graft count + default staffing.
        const result = calculateSurgeryProfitability({
          tenant_id: tid,
          procedure_type: m.procedure_type,
          cost_model: m,
          revenue: {
            revenue_cents: 0,
            collected_cents: 0,
            outstanding_cents: 0,
          },
          duration_minutes: m.default_duration_minutes,
          staff_counts: { rn_count: 1, technician_count: 2, assistant_count: 1 },
          treatment_addons: { prp: false, exosome: false },
          graft_count: REF_GRAFTS,
          hair_count: null,
        });
        return {
          procedure_type: m.procedure_type,
          graft_consumable_cost_cents: m.graft_consumable_cost_cents,
          standard_cost_per_graft_cents: result.cost_per_graft_cents,
          standard_total_cost_cents: result.total_cost_cents,
          reference_graft_count: REF_GRAFTS,
        };
      });
  } catch {
    standards = [];
  }

  const [cpl, spend, costPerGraft] = await Promise.all([
    loadExpenseCplSummary(tid, {
      periodStart: period_start,
      periodEnd: period_end,
      supabase: db,
    }),
    Promise.resolve(
      aggregateExpenseSpendByCategory({
        period_start,
        period_end,
        expenses: spendInputs,
      })
    ),
    Promise.resolve(
      aggregateExpenseCostPerGraft({
        period_start,
        period_end,
        expenses: cpgExpenses,
        graftRows,
        standards,
      })
    ),
  ]);

  return {
    period_start,
    period_end,
    cpl,
    spend,
    costPerGraft,
  };
}

/**
 * Attach human-readable lead/case labels onto expense rows (Stage 5).
 */
export async function attachExpenseEntityLabels(
  tenantId: string,
  expenses: FiExpenseRow[],
  supabase?: SupabaseClient
): Promise<FiExpenseRow[]> {
  const tid = tenantId.trim();
  if (!tid || expenses.length === 0) return expenses;
  const db = client(supabase);

  const leadIds = [
    ...new Set(expenses.map((e) => e.lead_id).filter((id): id is string => Boolean(id))),
  ].slice(0, 200);
  const caseIds = [
    ...new Set(expenses.map((e) => e.case_id).filter((id): id is string => Boolean(id))),
  ].slice(0, 200);

  const leadLabels = new Map<string, string>();
  const caseLabels = new Map<string, string>();

  if (leadIds.length > 0) {
    const { data, error } = await db
      .from("fi_crm_leads")
      .select("id, summary")
      .eq("tenant_id", tid)
      .in("id", leadIds);
    if (!error && data) {
      for (const raw of data) {
        const r = raw as { id: string; summary: string | null };
        leadLabels.set(String(r.id), leadTitleFromRow(r.summary, String(r.id)));
      }
    }
  }

  if (caseIds.length > 0) {
    const { data, error } = await db
      .from("fi_cases")
      .select("id, treatment_type, external_id")
      .eq("tenant_id", tid)
      .in("id", caseIds);
    if (!error && data) {
      for (const raw of data) {
        const r = raw as {
          id: string;
          treatment_type: string | null;
          external_id: string | null;
        };
        const label =
          r.external_id?.trim() || r.treatment_type?.trim() || `Case ${String(r.id).slice(0, 8)}…`;
        caseLabels.set(String(r.id), label);
      }
    }
  }

  return expenses.map((e) => ({
    ...e,
    lead_label: e.lead_id ? (leadLabels.get(e.lead_id) ?? e.lead_label ?? null) : null,
    case_label: e.case_id ? (caseLabels.get(e.case_id) ?? e.case_label ?? null) : null,
  }));
}
