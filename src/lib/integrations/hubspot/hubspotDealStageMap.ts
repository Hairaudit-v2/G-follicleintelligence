/**
 * Maps inbound HubSpot deal stage strings to FI Revenue Intelligence pipeline stages.
 * Accepts canonical slugs directly or fuzzy-matches common HubSpot labels / dealstage values.
 */

export const REVENUE_PIPELINE_STAGES = [
  "appointment_scheduled",
  "consult_completed",
  "quote_sent",
  "deposit_pending",
  "deposit_paid",
  "surgery_booked",
  "won",
  "lost",
] as const;

export type RevenuePipelineStage = (typeof REVENUE_PIPELINE_STAGES)[number];

const CANONICAL = new Set<string>(REVENUE_PIPELINE_STAGES);

const STAGE_PATTERNS: ReadonlyArray<{ re: RegExp; stage: RevenuePipelineStage }> = [
  { re: /appointment.*sched|consult.*sched|booked.*consult|schedul.*appointment/i, stage: "appointment_scheduled" },
  { re: /consult.*(done|complete)|post[-\s]?consult/i, stage: "consult_completed" },
  { re: /quote.*sent|sent.*quote|proposal|treatment.*plan/i, stage: "quote_sent" },
  { re: /deposit.*pend|await.*deposit|pending.*deposit/i, stage: "deposit_pending" },
  { re: /deposit.*paid|paid.*deposit/i, stage: "deposit_paid" },
  { re: /surgery.*book|booked.*surgery|deposit.*book/i, stage: "surgery_booked" },
  { re: /won|closed\s*won|customer|surgery\s*done|existing\s*patient/i, stage: "won" },
  { re: /lost|closed\s*lost|disqual/i, stage: "lost" },
];

const STAGE_PROBABILITY: Record<RevenuePipelineStage, number> = {
  appointment_scheduled: 15,
  consult_completed: 30,
  quote_sent: 45,
  deposit_pending: 60,
  deposit_paid: 75,
  surgery_booked: 90,
  won: 100,
  lost: 0,
};

const STAGE_LABEL: Record<RevenuePipelineStage, string> = {
  appointment_scheduled: "Appointment scheduled",
  consult_completed: "Consult completed",
  quote_sent: "Quote sent",
  deposit_pending: "Deposit pending",
  deposit_paid: "Deposit paid",
  surgery_booked: "Surgery booked",
  won: "Won",
  lost: "Lost",
};

export type MapHubspotDealStageResult = {
  stage: RevenuePipelineStage | null;
  probability_score: number;
  unmapped: boolean;
};

export function mapHubspotDealStage(raw: string | null | undefined): MapHubspotDealStageResult {
  const t = raw?.trim();
  if (!t) return { stage: null, probability_score: 0, unmapped: false };

  const normalized = t.toLowerCase().replace(/\s+/g, "_");
  if (CANONICAL.has(normalized)) {
    const stage = normalized as RevenuePipelineStage;
    return { stage, probability_score: STAGE_PROBABILITY[stage], unmapped: false };
  }

  for (const { re, stage } of STAGE_PATTERNS) {
    if (re.test(t)) return { stage, probability_score: STAGE_PROBABILITY[stage], unmapped: false };
  }

  return { stage: null, probability_score: 0, unmapped: true };
}

export function revenuePipelineStageLabel(stage: RevenuePipelineStage): string {
  return STAGE_LABEL[stage];
}

export function probabilityScoreForStage(stage: RevenuePipelineStage): number {
  return STAGE_PROBABILITY[stage];
}

/**
 * Parse Zapier / HubSpot amount fields to a dollar amount (not cents).
 */
export function parseHubspotDealAmount(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return null;
    return raw;
  }
  const s0 = String(raw).trim();
  if (!s0) return null;
  const stripped = s0.replace(/aud|nzd|usd|gbp|eur/gi, "").replace(/[$€£,\s]/g, "").trim();
  if (!stripped) return null;
  const n = Number.parseFloat(stripped);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function formatRevenueDisplayAmount(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function buildHubspotDealTimelineTitle(
  stage: RevenuePipelineStage | null,
  expectedRevenue: number | null
): string {
  if (stage === "quote_sent" && expectedRevenue != null) {
    return `Treatment quote updated — ${formatRevenueDisplayAmount(expectedRevenue)}`;
  }
  if (expectedRevenue != null) {
    const label = stage ? revenuePipelineStageLabel(stage) : "Deal updated";
    return `${label} — ${formatRevenueDisplayAmount(expectedRevenue)}`;
  }
  if (stage) return `Deal stage updated — ${revenuePipelineStageLabel(stage)}`;
  return "HubSpot deal updated";
}

export function computeBalanceAmount(
  expectedRevenue: number | null,
  depositAmount: number | null
): number | null {
  if (expectedRevenue == null) return null;
  if (depositAmount == null) return expectedRevenue;
  const balance = expectedRevenue - depositAmount;
  return balance >= 0 ? balance : 0;
}

export function parseHubspotCloseDate(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
