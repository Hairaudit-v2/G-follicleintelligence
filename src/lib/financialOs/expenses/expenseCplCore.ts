/**
 * Pure CPL (cost per lead) aggregation for FinancialOS Stage 4.
 * Marketing spend = posted expenses in marketing categories (or campaign_key set).
 */

export type ExpenseCplSpendInput = {
  expense_id: string;
  amount_cents: number;
  expense_date: string;
  campaign_key: string | null;
  category_code: string | null;
  status: string;
};

export type ExpenseCplLeadInput = {
  lead_id: string;
  created_at: string;
  /** Optional campaign/source key from lead metadata. */
  campaign_key: string | null;
};

export type ExpenseCplCampaignRow = {
  campaign_key: string;
  spend_cents: number;
  lead_count: number;
  cpl_cents: number | null;
};

export type ExpenseCplSummary = {
  period_start: string;
  period_end: string;
  total_marketing_spend_cents: number;
  total_leads: number;
  overall_cpl_cents: number | null;
  by_campaign: ExpenseCplCampaignRow[];
  unattributed_spend_cents: number;
};

const MARKETING_CATEGORY_PREFIXES = ["marketing_"] as const;

export function isMarketingExpense(input: {
  category_code?: string | null;
  campaign_key?: string | null;
}): boolean {
  const code = (input.category_code ?? "").trim().toLowerCase();
  if (code && MARKETING_CATEGORY_PREFIXES.some((p) => code.startsWith(p))) return true;
  if (input.campaign_key?.trim()) return true;
  return false;
}

function inDateRangeYmd(dateYmd: string, start: string, end: string): boolean {
  const d = dateYmd.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

function inIsoRange(iso: string, start: string, end: string): boolean {
  const d = iso.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

export function computeCplCents(spendCents: number, leadCount: number): number | null {
  if (!Number.isFinite(spendCents) || spendCents < 0) return null;
  if (!Number.isFinite(leadCount) || leadCount <= 0) return null;
  return Math.round(spendCents / leadCount);
}

/**
 * Aggregate CPL for a period. Only **posted** expenses count as spend.
 * Leads counted by created_at date. Campaign key matching is case-insensitive.
 */
export function aggregateExpenseCpl(input: {
  period_start: string;
  period_end: string;
  expenses: readonly ExpenseCplSpendInput[];
  leads: readonly ExpenseCplLeadInput[];
}): ExpenseCplSummary {
  const period_start = input.period_start.slice(0, 10);
  const period_end = input.period_end.slice(0, 10);

  const spendByCampaign = new Map<string, number>();
  let unattributed_spend_cents = 0;
  let total_marketing_spend_cents = 0;

  for (const exp of input.expenses) {
    if (exp.status !== "posted") continue;
    if (!inDateRangeYmd(exp.expense_date, period_start, period_end)) continue;
    if (!isMarketingExpense(exp)) continue;

    const amount = Math.max(0, Math.floor(exp.amount_cents));
    total_marketing_spend_cents += amount;
    const key = exp.campaign_key?.trim();
    if (key) {
      const k = key.toLowerCase();
      spendByCampaign.set(k, (spendByCampaign.get(k) ?? 0) + amount);
    } else {
      unattributed_spend_cents += amount;
    }
  }

  const leadsByCampaign = new Map<string, number>();
  let total_leads = 0;
  for (const lead of input.leads) {
    if (!inIsoRange(lead.created_at, period_start, period_end)) continue;
    total_leads += 1;
    const key = lead.campaign_key?.trim();
    if (key) {
      const k = key.toLowerCase();
      leadsByCampaign.set(k, (leadsByCampaign.get(k) ?? 0) + 1);
    }
  }

  const campaignKeys = new Set([...spendByCampaign.keys(), ...leadsByCampaign.keys()]);
  const by_campaign: ExpenseCplCampaignRow[] = [...campaignKeys]
    .map((k) => {
      const spend_cents = spendByCampaign.get(k) ?? 0;
      const lead_count = leadsByCampaign.get(k) ?? 0;
      return {
        campaign_key: k,
        spend_cents,
        lead_count,
        cpl_cents: computeCplCents(spend_cents, lead_count),
      };
    })
    .sort((a, b) => b.spend_cents - a.spend_cents || a.campaign_key.localeCompare(b.campaign_key));

  return {
    period_start,
    period_end,
    total_marketing_spend_cents,
    total_leads,
    overall_cpl_cents: computeCplCents(total_marketing_spend_cents, total_leads),
    by_campaign,
    unattributed_spend_cents,
  };
}

/** Default rolling 30-day window ending today (UTC YMD). */
export function defaultCplPeriod(todayYmd?: string): { period_start: string; period_end: string } {
  const end = (todayYmd ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const d = new Date(`${end}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 29);
  const start = d.toISOString().slice(0, 10);
  return { period_start: start, period_end: end };
}
