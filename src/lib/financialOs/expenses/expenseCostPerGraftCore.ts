/**
 * Pure cost-per-graft actuals vs standard cost models (FinancialOS Stage 5).
 *
 * Actuals: posted clinical/consumable expenses linked to case or procedure_type,
 * divided by grafts implanted (or snapshot graft_count).
 * Standard: active surgery cost model graft consumable rate / calculated CPG.
 */

export type ExpenseCpgSpendInput = {
  expense_id: string;
  amount_cents: number;
  expense_date: string;
  status: string;
  category_code: string | null;
  case_id: string | null;
  procedure_type: string | null;
};

export type ExpenseCpgGraftInput = {
  case_id: string;
  procedure_type: string | null;
  grafts_implanted: number | null;
  procedure_date: string | null;
};

export type ExpenseCpgStandardModel = {
  procedure_type: string;
  /** From active cost model: graft consumable unit cost. */
  graft_consumable_cost_cents: number;
  /**
   * Full-model standard cost_per_graft (Stage 8: from calculateSurgeryProfitability
   * with default staffing/duration and reference graft count).
   */
  standard_cost_per_graft_cents: number | null;
  /** Optional full model total cost at reference graft count (for transparency). */
  standard_total_cost_cents?: number | null;
  reference_graft_count?: number | null;
};

export type ExpenseCpgProcedureRow = {
  procedure_type: string;
  spend_cents: number;
  grafts_implanted: number;
  actual_cost_per_graft_cents: number | null;
  standard_graft_consumable_cents: number | null;
  standard_cost_per_graft_cents: number | null;
  variance_vs_standard_cents: number | null;
  case_count: number;
  expense_count: number;
};

export type ExpenseCpgSummary = {
  period_start: string;
  period_end: string;
  total_clinical_spend_cents: number;
  total_grafts_implanted: number;
  overall_actual_cpg_cents: number | null;
  by_procedure: ExpenseCpgProcedureRow[];
  unlinked_clinical_spend_cents: number;
};

const CLINICAL_CATEGORY_CODES = new Set([
  "clinical_consumables",
  "medications",
  "equipment",
]);

export function isClinicalConsumableExpense(categoryCode: string | null | undefined): boolean {
  const c = (categoryCode ?? "").trim().toLowerCase();
  return CLINICAL_CATEGORY_CODES.has(c);
}

function inDateRangeYmd(dateYmd: string | null, start: string, end: string): boolean {
  if (!dateYmd) return false;
  const d = dateYmd.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

export function computeCostPerGraftCents(
  spendCents: number,
  grafts: number
): number | null {
  if (!Number.isFinite(spendCents) || spendCents < 0) return null;
  if (!Number.isFinite(grafts) || grafts <= 0) return null;
  return Math.round(spendCents / grafts);
}

/**
 * Aggregate actual CPG from posted clinical expenses vs standard models.
 * Grafts come from procedure-day rows (or equivalent) in period.
 */
export function aggregateExpenseCostPerGraft(input: {
  period_start: string;
  period_end: string;
  expenses: readonly ExpenseCpgSpendInput[];
  graftRows: readonly ExpenseCpgGraftInput[];
  standards: readonly ExpenseCpgStandardModel[];
}): ExpenseCpgSummary {
  const period_start = input.period_start.slice(0, 10);
  const period_end = input.period_end.slice(0, 10);

  const standardByProc = new Map(
    input.standards.map((s) => [s.procedure_type.trim().toLowerCase(), s])
  );

  // Grafts by procedure + case set for procedure types
  const graftsByProc = new Map<string, number>();
  const casesByProc = new Map<string, Set<string>>();
  let total_grafts_implanted = 0;

  for (const g of input.graftRows) {
    const grafts = g.grafts_implanted != null ? Math.floor(g.grafts_implanted) : 0;
    if (grafts <= 0) continue;
    if (g.procedure_date && !inDateRangeYmd(g.procedure_date, period_start, period_end)) {
      continue;
    }
    // If no procedure_date, still count when case-linked expenses need graft totals for that case's type
    const proc = (g.procedure_type ?? "unknown").trim().toLowerCase() || "unknown";
    graftsByProc.set(proc, (graftsByProc.get(proc) ?? 0) + grafts);
    total_grafts_implanted += grafts;
    const set = casesByProc.get(proc) ?? new Set<string>();
    set.add(g.case_id);
    casesByProc.set(proc, set);
  }

  // Map case_id -> procedure_type from graft rows
  const caseToProc = new Map<string, string>();
  for (const g of input.graftRows) {
    const proc = (g.procedure_type ?? "unknown").trim().toLowerCase() || "unknown";
    caseToProc.set(g.case_id, proc);
  }

  const spendByProc = new Map<string, number>();
  const expenseCountByProc = new Map<string, number>();
  let total_clinical_spend_cents = 0;
  let unlinked_clinical_spend_cents = 0;

  for (const exp of input.expenses) {
    if (exp.status !== "posted") continue;
    if (!inDateRangeYmd(exp.expense_date, period_start, period_end)) continue;

    // Clinical categories, or any expense explicitly linked to case / procedure_type.
    const isClinical =
      isClinicalConsumableExpense(exp.category_code) ||
      Boolean(exp.procedure_type?.trim()) ||
      Boolean(exp.case_id);
    if (!isClinical) continue;

    const amount = Math.max(0, Math.floor(exp.amount_cents));
    total_clinical_spend_cents += amount;

    const proc =
      exp.procedure_type?.trim().toLowerCase() ||
      (exp.case_id ? caseToProc.get(exp.case_id) : null) ||
      null;

    if (!proc) {
      unlinked_clinical_spend_cents += amount;
      continue;
    }

    spendByProc.set(proc, (spendByProc.get(proc) ?? 0) + amount);
    expenseCountByProc.set(proc, (expenseCountByProc.get(proc) ?? 0) + 1);
  }

  const procKeys = new Set([
    ...spendByProc.keys(),
    ...graftsByProc.keys(),
    ...standardByProc.keys(),
  ]);

  const by_procedure: ExpenseCpgProcedureRow[] = [...procKeys]
    .map((procedure_type) => {
      const spend_cents = spendByProc.get(procedure_type) ?? 0;
      const grafts_implanted = graftsByProc.get(procedure_type) ?? 0;
      const actual = computeCostPerGraftCents(spend_cents, grafts_implanted);
      const std = standardByProc.get(procedure_type) ?? null;
      const standardCpg = std?.standard_cost_per_graft_cents ?? null;
      const variance =
        actual != null && standardCpg != null ? actual - standardCpg : null;
      return {
        procedure_type,
        spend_cents,
        grafts_implanted,
        actual_cost_per_graft_cents: actual,
        standard_graft_consumable_cents: std?.graft_consumable_cost_cents ?? null,
        standard_cost_per_graft_cents: standardCpg,
        variance_vs_standard_cents: variance,
        case_count: casesByProc.get(procedure_type)?.size ?? 0,
        expense_count: expenseCountByProc.get(procedure_type) ?? 0,
      };
    })
    .filter(
      (r) =>
        r.spend_cents > 0 ||
        r.grafts_implanted > 0 ||
        r.standard_cost_per_graft_cents != null ||
        r.standard_graft_consumable_cents != null
    )
    .sort(
      (a, b) => b.spend_cents - a.spend_cents || a.procedure_type.localeCompare(b.procedure_type)
    );

  return {
    period_start,
    period_end,
    total_clinical_spend_cents,
    total_grafts_implanted,
    overall_actual_cpg_cents: computeCostPerGraftCents(
      total_clinical_spend_cents - unlinked_clinical_spend_cents,
      total_grafts_implanted
    ),
    by_procedure,
    unlinked_clinical_spend_cents,
  };
}
