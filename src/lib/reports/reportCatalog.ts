/**
 * Reports Library catalog — pure registry (no DB, no I/O).
 * Phase 1: financial reports powered by Expenses Capture engines.
 */

export type ReportCategory = "financial" | "revenue" | "clinical" | "ops";

export type ReportId =
  | "expense_breakdown"
  | "marketing_cpl"
  | "cost_per_graft_actuals"
  | "operating_pl"
  | "surgery_gross_margin"
  | "revenue_attribution_summary"
  | "ar_aging_summary"
  | "expense_export_pack";

export type ReportPeriodPreset = "30d" | "90d" | "ytd";

export type ReportDefinition = {
  id: ReportId;
  title: string;
  description: string;
  category: ReportCategory;
  /** Staff module required when generating (beyond portal membership). */
  requiredModules: readonly ("financial_os" | "surgery_os" | "analytics_os")[];
  defaultPeriodPreset: ReportPeriodPreset;
  supportsCsv: boolean;
  /** When true, Generate is wired end-to-end. */
  generateEnabled: boolean;
  /** Deep-link to live operational surface for the same data. */
  livePathSuffix?: string;
  phase: 1 | 2 | 3;
  badges?: readonly string[];
};

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  financial: "Financial",
  revenue: "Revenue",
  clinical: "Clinical",
  ops: "Operations",
};

export const REPORT_CATALOG: readonly ReportDefinition[] = [
  {
    id: "expense_breakdown",
    title: "Expense breakdown by category",
    description:
      "Posted expenses grouped by category for the selected period — totals, counts, and share of spend.",
    category: "financial",
    requiredModules: ["financial_os"],
    defaultPeriodPreset: "30d",
    supportsCsv: true,
    generateEnabled: true,
    livePathSuffix: "financial/expenses",
    phase: 1,
    badges: ["Posted expenses", "CSV"],
  },
  {
    id: "marketing_cpl",
    title: "Marketing cost per lead (CPL)",
    description: "Marketing spend versus lead volume by campaign for the selected period.",
    category: "financial",
    requiredModules: ["financial_os"],
    defaultPeriodPreset: "90d",
    supportsCsv: true,
    generateEnabled: true,
    livePathSuffix: "financial/expenses",
    phase: 1,
    badges: ["Posted expenses", "Leads", "CSV"],
  },
  {
    id: "cost_per_graft_actuals",
    title: "Cost per graft (actuals)",
    description:
      "Clinical spend and graft volume for cost-per-graft actuals versus model baselines.",
    category: "financial",
    requiredModules: ["financial_os"],
    defaultPeriodPreset: "90d",
    supportsCsv: true,
    generateEnabled: true,
    livePathSuffix: "financial/expenses",
    phase: 1,
    badges: ["Clinical spend", "CSV"],
  },
  {
    id: "operating_pl",
    title: "Operating P&L (period)",
    description: "Revenue and operating expense summary for clinic P&L over the period.",
    category: "financial",
    requiredModules: ["financial_os"],
    defaultPeriodPreset: "ytd",
    supportsCsv: true,
    generateEnabled: true,
    livePathSuffix: "financial/expenses",
    phase: 1,
    badges: ["Ledger", "CSV"],
  },
  {
    id: "surgery_gross_margin",
    title: "Surgery gross margin",
    description: "Procedure profitability from surgery economics snapshots.",
    category: "revenue",
    requiredModules: ["financial_os"],
    defaultPeriodPreset: "90d",
    supportsCsv: true,
    generateEnabled: true,
    livePathSuffix: "financial-os",
    phase: 1,
    badges: ["Snapshots", "CSV"],
  },
  {
    id: "revenue_attribution_summary",
    title: "Revenue attribution summary",
    description: "Attributed revenue by source, campaign, and consultant.",
    category: "revenue",
    requiredModules: ["financial_os"],
    defaultPeriodPreset: "90d",
    supportsCsv: true,
    generateEnabled: true,
    livePathSuffix: "financial-os",
    phase: 1,
    badges: ["Attribution", "CSV"],
  },
  {
    id: "ar_aging_summary",
    title: "Accounts receivable aging",
    description: "Open AR balances grouped by risk and age band.",
    category: "revenue",
    requiredModules: ["financial_os"],
    defaultPeriodPreset: "30d",
    supportsCsv: true,
    generateEnabled: true,
    livePathSuffix: "financial-os/accounts-receivable",
    phase: 1,
    badges: ["AR work queue", "CSV"],
  },
  {
    id: "expense_export_pack",
    title: "Expense export pack",
    description: "FI / QuickBooks / Xero CSV export for the selected expense period.",
    category: "financial",
    requiredModules: ["financial_os"],
    defaultPeriodPreset: "30d",
    supportsCsv: true,
    generateEnabled: true,
    livePathSuffix: "financial/expenses",
    phase: 1,
    badges: ["Multi-file", "CSV"],
  },
] as const;

export function getReportDefinition(id: string): ReportDefinition | null {
  const key = id.trim();
  return REPORT_CATALOG.find((r) => r.id === key) ?? null;
}

export function listReports(options?: {
  category?: ReportCategory | "all";
  query?: string;
  phaseMax?: 1 | 2 | 3;
}): ReportDefinition[] {
  const category = options?.category ?? "all";
  const q = (options?.query ?? "").trim().toLowerCase();
  const phaseMax = options?.phaseMax ?? 1;

  return REPORT_CATALOG.filter((r) => {
    if (r.phase > phaseMax) return false;
    if (category !== "all" && r.category !== category) return false;
    if (!q) return true;
    const hay = [r.title, r.description, r.id, r.category, ...(r.badges ?? [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function buildReportLiveHref(tenantId: string, def: ReportDefinition): string | null {
  if (!def.livePathSuffix) return null;
  const tid = tenantId.trim();
  if (!tid) return null;
  return `/fi-admin/${tid}/${def.livePathSuffix.replace(/^\/+/, "")}`;
}

export function isReportId(value: string): value is ReportId {
  return REPORT_CATALOG.some((r) => r.id === value);
}
