/**
 * FinancialOS Phase 3 — pure revenue attribution resolver.
 * Connects LeadFlow, ConsultationOS, SurgeryOS, and FinancialOS without DB I/O.
 */

export const FI_REVENUE_ATTRIBUTION_SOURCES = [
  "google_ads",
  "meta_ads",
  "organic",
  "referral",
  "ambassador",
  "existing_patient",
  "direct",
  "unknown",
] as const;
export type FiRevenueAttributionSource = (typeof FI_REVENUE_ATTRIBUTION_SOURCES)[number];

export const FI_REVENUE_ATTRIBUTION_CONFIDENCE = ["direct", "inferred", "manual"] as const;
export type FiRevenueAttributionConfidence = (typeof FI_REVENUE_ATTRIBUTION_CONFIDENCE)[number];

export type LeadSourceContext = {
  lead_id: string | null;
  lead_metadata: Record<string, unknown>;
  lead_source_systems: string[];
  lead_clinic_id: string | null;
  lead_primary_owner_user_id: string | null;
  patient_metadata: Record<string, unknown>;
  patient_source_systems: string[];
  consultation_source: string | null;
  consultation_metadata: Record<string, unknown>;
  manual_override: RevenueAttributionManualOverride | null;
};

export type RevenueAttributionManualOverride = {
  attribution_source: FiRevenueAttributionSource | null;
  campaign_name: string | null;
  campaign_id: string | null;
  consultant_fi_user_id: string | null;
};

export type ConsultantAttributionContext = {
  manual_consultant_fi_user_id: string | null;
  lead_primary_owner_user_id: string | null;
  consultation_owner_fi_user_id: string | null;
  consultation_staff_fi_user_id: string | null;
  quote_creator_fi_user_id: string | null;
  case_owner_fi_user_id: string | null;
};

export type ClinicAttributionContext = {
  invoice_clinic_id: string | null;
  case_clinic_id: string | null;
  lead_clinic_id: string | null;
};

export type CampaignAttributionContext = {
  lead_metadata: Record<string, unknown>;
  consultation_metadata: Record<string, unknown>;
  manual_campaign_name: string | null;
  manual_campaign_id: string | null;
};

export type RevenueAttributionAmounts = {
  attributed_revenue_cents: number;
  attributed_collected_cents: number;
  gross_profit_cents: number | null;
};

export type RevenueAttributionEventDraft = {
  tenant_id: string;
  patient_id: string | null;
  lead_id: string | null;
  case_id: string | null;
  consultation_id: string | null;
  surgery_id: string | null;
  invoice_id: string | null;
  payment_id: string | null;
  transaction_id: string | null;
  attribution_source: FiRevenueAttributionSource;
  campaign_name: string | null;
  campaign_id: string | null;
  ad_group: string | null;
  keyword: string | null;
  referral_contact_id: string | null;
  consultant_fi_user_id: string | null;
  clinic_id: string | null;
  attributed_revenue_cents: number;
  attributed_collected_cents: number;
  gross_profit_cents: number | null;
  attribution_confidence: FiRevenueAttributionConfidence;
  source_metadata: Record<string, unknown>;
  idempotency_key: string | null;
  occurred_at: string;
};

export type BuildRevenueAttributionEventInput = {
  tenant_id: string;
  patient_id?: string | null;
  lead_id?: string | null;
  case_id?: string | null;
  consultation_id?: string | null;
  surgery_id?: string | null;
  invoice_id?: string | null;
  payment_id?: string | null;
  transaction_id?: string | null;
  lead_context: LeadSourceContext;
  consultant_context: ConsultantAttributionContext;
  clinic_context: ClinicAttributionContext;
  campaign_context: CampaignAttributionContext;
  amounts: RevenueAttributionAmounts;
  trigger_source: string;
  idempotency_key?: string | null;
  occurred_at?: string;
  invoice_total_cents?: number | null;
  procedure_type?: string | null;
};

function readMetaString(meta: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function readNestedMetaString(meta: Record<string, unknown>, path: string[]): string | null {
  let cur: unknown = meta;
  for (const key of path) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "string" && cur.trim() ? cur.trim() : null;
}

function normaliseSourceToken(raw: string): FiRevenueAttributionSource | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!s) return null;
  if (
    s.includes("google") ||
    s.includes("gclid") ||
    s === "google_ads" ||
    s === "adwords" ||
    s === "ppc"
  ) {
    return "google_ads";
  }
  if (
    s.includes("meta") ||
    s.includes("facebook") ||
    s.includes("instagram") ||
    s.includes("fb_ads") ||
    s === "meta_ads"
  ) {
    return "meta_ads";
  }
  if (s.includes("referral") || s.includes("referred") || s === "friend") return "referral";
  if (s.includes("ambassador") || s.includes("affiliate")) return "ambassador";
  if (
    s.includes("existing") ||
    s.includes("returning") ||
    s.includes("repeat") ||
    s.includes("existing_patient")
  ) {
    return "existing_patient";
  }
  if (s.includes("organic") || s.includes("seo") || s.includes("website") || s === "search")
    return "organic";
  if (s.includes("direct") || s.includes("walk_in") || s.includes("walkin") || s === "in_clinic")
    return "direct";
  if ((FI_REVENUE_ATTRIBUTION_SOURCES as readonly string[]).includes(s))
    return s as FiRevenueAttributionSource;
  return null;
}

function extractRawSourceSignals(
  ctx: LeadSourceContext
): Array<{ value: string; channel: string }> {
  const signals: Array<{ value: string; channel: string }> = [];
  const override = ctx.manual_override?.attribution_source;
  if (override) signals.push({ value: override, channel: "manual_override" });

  for (const sys of ctx.lead_source_systems) {
    if (sys.trim()) signals.push({ value: sys, channel: "lead_source_system" });
  }

  const hubspotLeadSource = readNestedMetaString(ctx.lead_metadata, ["hubspot", "lead_source"]);
  if (hubspotLeadSource) signals.push({ value: hubspotLeadSource, channel: "hubspot_lead_source" });

  const metaLeadSource = readMetaString(ctx.lead_metadata, [
    "lead_source",
    "source",
    "attribution_source",
    "utm_source",
    "crm_source_system",
    "source_system",
  ]);
  if (metaLeadSource) signals.push({ value: metaLeadSource, channel: "lead_metadata" });

  for (const sys of ctx.patient_source_systems) {
    if (sys.trim()) signals.push({ value: sys, channel: "patient_source_system" });
  }

  const patientSource = readMetaString(ctx.patient_metadata, [
    "source",
    "lead_source",
    "patient_source",
  ]);
  if (patientSource) signals.push({ value: patientSource, channel: "patient_metadata" });

  if (ctx.consultation_source?.trim()) {
    signals.push({ value: ctx.consultation_source.trim(), channel: "consultation_source" });
  }

  const consultSource = readMetaString(ctx.consultation_metadata, [
    "source",
    "lead_source",
    "referral_source",
  ]);
  if (consultSource) signals.push({ value: consultSource, channel: "consultation_metadata" });

  return signals;
}

export type LeadSourceAttributionResult = {
  attribution_source: FiRevenueAttributionSource;
  referral_contact_id: string | null;
  resolution_channel: string;
  raw_signal: string | null;
};

/** Resolve marketing attribution source from LeadFlow / patient / consultation signals. */
export function resolveLeadSourceAttribution(ctx: LeadSourceContext): LeadSourceAttributionResult {
  const signals = extractRawSourceSignals(ctx);
  for (const signal of signals) {
    const mapped = normaliseSourceToken(signal.value);
    if (mapped && mapped !== "unknown") {
      const referralContactId =
        mapped === "referral"
          ? (readMetaString(ctx.lead_metadata, ["referral_contact_id", "referrer_person_id"]) ??
            readMetaString(ctx.consultation_metadata, [
              "referral_contact_id",
              "referrer_person_id",
            ]))
          : null;
      return {
        attribution_source: mapped,
        referral_contact_id: referralContactId,
        resolution_channel: signal.channel,
        raw_signal: signal.value,
      };
    }
  }

  if (ctx.patient_source_systems.length > 0 || ctx.lead_id) {
    return {
      attribution_source: "existing_patient",
      referral_contact_id: null,
      resolution_channel: "patient_or_lead_link_inferred",
      raw_signal: null,
    };
  }

  return {
    attribution_source: "unknown",
    referral_contact_id: null,
    resolution_channel: "unknown_fallback",
    raw_signal: null,
  };
}

export type ConsultantAttributionResult = {
  consultant_fi_user_id: string | null;
  resolution_order: string;
};

/** Consultant fallback: manual → lead owner → consultation owner → quote creator → case owner. */
export function resolveConsultantAttribution(
  ctx: ConsultantAttributionContext
): ConsultantAttributionResult {
  const order: Array<{ key: string; value: string | null }> = [
    { key: "manual_override", value: ctx.manual_consultant_fi_user_id },
    { key: "lead_primary_owner", value: ctx.lead_primary_owner_user_id },
    { key: "consultation_owner", value: ctx.consultation_owner_fi_user_id },
    { key: "consultation_staff", value: ctx.consultation_staff_fi_user_id },
    { key: "quote_creator", value: ctx.quote_creator_fi_user_id },
    { key: "case_owner", value: ctx.case_owner_fi_user_id },
  ];
  for (const step of order) {
    if (step.value?.trim()) {
      return { consultant_fi_user_id: step.value.trim(), resolution_order: step.key };
    }
  }
  return { consultant_fi_user_id: null, resolution_order: "none" };
}

export type ClinicAttributionResult = {
  clinic_id: string | null;
  resolution_order: string;
};

/** Clinic fallback: invoice → case → lead. */
export function resolveClinicAttribution(ctx: ClinicAttributionContext): ClinicAttributionResult {
  if (ctx.invoice_clinic_id?.trim()) {
    return { clinic_id: ctx.invoice_clinic_id.trim(), resolution_order: "invoice" };
  }
  if (ctx.case_clinic_id?.trim()) {
    return { clinic_id: ctx.case_clinic_id.trim(), resolution_order: "case" };
  }
  if (ctx.lead_clinic_id?.trim()) {
    return { clinic_id: ctx.lead_clinic_id.trim(), resolution_order: "lead" };
  }
  return { clinic_id: null, resolution_order: "none" };
}

export type CampaignAttributionResult = {
  campaign_name: string | null;
  campaign_id: string | null;
  ad_group: string | null;
  keyword: string | null;
  resolution_channel: string;
};

/** Campaign fields from lead/consultation metadata or manual override. */
export function resolveCampaignAttribution(
  ctx: CampaignAttributionContext
): CampaignAttributionResult {
  if (ctx.manual_campaign_name?.trim() || ctx.manual_campaign_id?.trim()) {
    return {
      campaign_name: ctx.manual_campaign_name?.trim() || null,
      campaign_id: ctx.manual_campaign_id?.trim() || null,
      ad_group: null,
      keyword: null,
      resolution_channel: "manual_override",
    };
  }

  const metaSources: Array<{ meta: Record<string, unknown>; channel: string }> = [
    { meta: ctx.lead_metadata, channel: "lead_metadata" },
    { meta: ctx.consultation_metadata, channel: "consultation_metadata" },
  ];

  for (const { meta, channel } of metaSources) {
    const campaignName =
      readMetaString(meta, ["campaign_name", "utm_campaign"]) ??
      readNestedMetaString(meta, ["hubspot", "campaign_name"]) ??
      readNestedMetaString(meta, ["hubspot", "utm_campaign"]);
    const campaignId =
      readMetaString(meta, ["campaign_id", "utm_campaign_id"]) ??
      readNestedMetaString(meta, ["hubspot", "campaign_id"]);
    const adGroup = readMetaString(meta, ["ad_group", "utm_content", "adgroup"]);
    const keyword = readMetaString(meta, ["keyword", "utm_term"]);

    if (campaignName || campaignId || adGroup || keyword) {
      return {
        campaign_name: campaignName,
        campaign_id: campaignId,
        ad_group: adGroup,
        keyword: keyword,
        resolution_channel: channel,
      };
    }
  }

  return {
    campaign_name: null,
    campaign_id: null,
    ad_group: null,
    keyword: null,
    resolution_channel: "none",
  };
}

/** Integer cents revenue attribution for a payment or invoice event. */
export function calculateAttributedRevenue(args: {
  payment_amount_cents?: number | null;
  invoice_total_cents?: number | null;
  collected_cents?: number | null;
  gross_profit_cents?: number | null;
}): RevenueAttributionAmounts {
  const payment = Math.max(0, Math.floor(args.payment_amount_cents ?? 0));
  const invoiceTotal = Math.max(0, Math.floor(args.invoice_total_cents ?? 0));
  const collected = Math.max(0, Math.floor(args.collected_cents ?? payment));
  const attributedRevenue = payment > 0 ? payment : invoiceTotal;
  const attributedCollected = payment > 0 ? payment : collected;
  const grossProfit =
    args.gross_profit_cents != null && Number.isFinite(args.gross_profit_cents)
      ? Math.floor(args.gross_profit_cents)
      : null;

  return {
    attributed_revenue_cents: attributedRevenue,
    attributed_collected_cents: attributedCollected,
    gross_profit_cents: grossProfit,
  };
}

export type AttributionConfidenceInput = {
  has_manual_override: boolean;
  lead_resolution_channel: string;
  has_direct_lead_source: boolean;
  has_campaign: boolean;
  trigger_source: string;
};

/** Confidence: manual override → direct; lead source system → direct; else inferred; unknown fallback → inferred. */
export function calculateAttributionConfidence(
  input: AttributionConfidenceInput
): FiRevenueAttributionConfidence {
  if (input.has_manual_override) return "manual";
  if (input.has_direct_lead_source || input.lead_resolution_channel === "lead_source_system")
    return "direct";
  if (
    input.lead_resolution_channel === "hubspot_lead_source" ||
    input.lead_resolution_channel === "manual_override"
  ) {
    return "direct";
  }
  if (input.trigger_source === "manual_recalculation") return "manual";
  return "inferred";
}

/** Compose a fully-resolved attribution event draft (caller persists append-only). */
export function buildRevenueAttributionEvent(
  input: BuildRevenueAttributionEventInput
): RevenueAttributionEventDraft {
  const leadResult = resolveLeadSourceAttribution(input.lead_context);
  const consultantResult = resolveConsultantAttribution(input.consultant_context);
  const clinicResult = resolveClinicAttribution(input.clinic_context);
  const campaignResult = resolveCampaignAttribution(input.campaign_context);

  const amounts =
    input.amounts.attributed_revenue_cents > 0 || input.amounts.attributed_collected_cents > 0
      ? input.amounts
      : calculateAttributedRevenue({
          payment_amount_cents: input.amounts.attributed_collected_cents,
          invoice_total_cents: input.invoice_total_cents ?? null,
          collected_cents: input.amounts.attributed_collected_cents,
          gross_profit_cents: input.amounts.gross_profit_cents,
        });

  const hasManualOverride = Boolean(
    input.lead_context.manual_override?.attribution_source ||
    input.lead_context.manual_override?.campaign_name ||
    input.lead_context.manual_override?.campaign_id ||
    input.lead_context.manual_override?.consultant_fi_user_id
  );

  const confidence = calculateAttributionConfidence({
    has_manual_override: hasManualOverride,
    lead_resolution_channel: leadResult.resolution_channel,
    has_direct_lead_source: input.lead_context.lead_source_systems.length > 0,
    has_campaign: Boolean(campaignResult.campaign_name || campaignResult.campaign_id),
    trigger_source: input.trigger_source,
  });

  const source =
    input.lead_context.manual_override?.attribution_source ?? leadResult.attribution_source;

  return {
    tenant_id: input.tenant_id.trim(),
    patient_id: input.patient_id?.trim() || null,
    lead_id: input.lead_id?.trim() || null,
    case_id: input.case_id?.trim() || null,
    consultation_id: input.consultation_id?.trim() || null,
    surgery_id: input.surgery_id?.trim() || null,
    invoice_id: input.invoice_id?.trim() || null,
    payment_id: input.payment_id?.trim() || null,
    transaction_id: input.transaction_id?.trim() || null,
    attribution_source: source,
    campaign_name: campaignResult.campaign_name,
    campaign_id: campaignResult.campaign_id,
    ad_group: campaignResult.ad_group,
    keyword: campaignResult.keyword,
    referral_contact_id: leadResult.referral_contact_id,
    consultant_fi_user_id: consultantResult.consultant_fi_user_id,
    clinic_id: clinicResult.clinic_id,
    attributed_revenue_cents: amounts.attributed_revenue_cents,
    attributed_collected_cents: amounts.attributed_collected_cents,
    gross_profit_cents: amounts.gross_profit_cents,
    attribution_confidence: confidence,
    source_metadata: {
      trigger_source: input.trigger_source,
      lead_resolution_channel: leadResult.resolution_channel,
      lead_raw_signal: leadResult.raw_signal,
      consultant_resolution_order: consultantResult.resolution_order,
      clinic_resolution_order: clinicResult.resolution_order,
      campaign_resolution_channel: campaignResult.resolution_channel,
      procedure_type: input.procedure_type ?? null,
    },
    idempotency_key: input.idempotency_key?.trim() || null,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
  };
}

export type RevenueAttributionDashboardRow = {
  source: FiRevenueAttributionSource;
  campaign: string;
  leads: number;
  consults: number;
  invoices: number;
  collected_revenue_cents: number;
  gross_profit_cents: number;
  margin_percentage: number | null;
  confidence: FiRevenueAttributionConfidence;
};

export type RevenueAttributionDashboardMetrics = {
  revenue_by_source: Array<{ source: FiRevenueAttributionSource; cents: number }>;
  gross_profit_by_source: Array<{ source: FiRevenueAttributionSource; cents: number }>;
  best_converting_source: { source: FiRevenueAttributionSource; conversion_rate: number } | null;
  highest_margin_source: { source: FiRevenueAttributionSource; margin_percentage: number } | null;
  unknown_attribution_percentage: number;
};

export type RevenueAttributionEventSummary = {
  id: string;
  attribution_source: FiRevenueAttributionSource;
  campaign_name: string | null;
  lead_id: string | null;
  consultation_id: string | null;
  invoice_id: string | null;
  attributed_collected_cents: number;
  gross_profit_cents: number | null;
  attribution_confidence: FiRevenueAttributionConfidence;
  procedure_type: string | null;
};

function marginPct(revenue: number, profit: number): number | null {
  if (revenue <= 0) return null;
  return Math.round((profit / revenue) * 10_000) / 100;
}

/** Aggregate dashboard metrics from event summaries (tenant-scoped rows only). */
export function aggregateRevenueAttributionDashboard(events: RevenueAttributionEventSummary[]): {
  metrics: RevenueAttributionDashboardMetrics;
  rows: RevenueAttributionDashboardRow[];
} {
  const byKey = new Map<
    string,
    {
      source: FiRevenueAttributionSource;
      campaign: string;
      leadIds: Set<string>;
      consultIds: Set<string>;
      invoiceIds: Set<string>;
      collected: number;
      profit: number;
      confidenceCounts: Record<FiRevenueAttributionConfidence, number>;
    }
  >();

  let totalCollected = 0;
  let unknownCollected = 0;

  for (const ev of events) {
    const campaign = ev.campaign_name?.trim() || "—";
    const key = `${ev.attribution_source}::${campaign}`;
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = {
        source: ev.attribution_source,
        campaign,
        leadIds: new Set(),
        consultIds: new Set(),
        invoiceIds: new Set(),
        collected: 0,
        profit: 0,
        confidenceCounts: { direct: 0, inferred: 0, manual: 0 },
      };
      byKey.set(key, bucket);
    }
    if (ev.lead_id) bucket.leadIds.add(ev.lead_id);
    if (ev.consultation_id) bucket.consultIds.add(ev.consultation_id);
    if (ev.invoice_id) bucket.invoiceIds.add(ev.invoice_id);
    bucket.collected += ev.attributed_collected_cents;
    bucket.profit += ev.gross_profit_cents ?? 0;
    bucket.confidenceCounts[ev.attribution_confidence] += 1;
    totalCollected += ev.attributed_collected_cents;
    if (ev.attribution_source === "unknown") unknownCollected += ev.attributed_collected_cents;
  }

  const revenueBySource = new Map<FiRevenueAttributionSource, number>();
  const profitBySource = new Map<FiRevenueAttributionSource, number>();
  const leadsBySource = new Map<FiRevenueAttributionSource, number>();
  const consultsBySource = new Map<FiRevenueAttributionSource, number>();

  for (const bucket of byKey.values()) {
    revenueBySource.set(
      bucket.source,
      (revenueBySource.get(bucket.source) ?? 0) + bucket.collected
    );
    profitBySource.set(bucket.source, (profitBySource.get(bucket.source) ?? 0) + bucket.profit);
    leadsBySource.set(bucket.source, (leadsBySource.get(bucket.source) ?? 0) + bucket.leadIds.size);
    consultsBySource.set(
      bucket.source,
      (consultsBySource.get(bucket.source) ?? 0) + bucket.consultIds.size
    );
  }

  let bestConverting: { source: FiRevenueAttributionSource; conversion_rate: number } | null = null;
  for (const source of FI_REVENUE_ATTRIBUTION_SOURCES) {
    const leads = leadsBySource.get(source) ?? 0;
    const consults = consultsBySource.get(source) ?? 0;
    if (leads <= 0) continue;
    const rate = consults / leads;
    if (!bestConverting || rate > bestConverting.conversion_rate) {
      bestConverting = { source, conversion_rate: Math.round(rate * 10_000) / 100 };
    }
  }

  let highestMargin: { source: FiRevenueAttributionSource; margin_percentage: number } | null =
    null;
  for (const source of FI_REVENUE_ATTRIBUTION_SOURCES) {
    const rev = revenueBySource.get(source) ?? 0;
    const profit = profitBySource.get(source) ?? 0;
    const m = marginPct(rev, profit);
    if (m == null) continue;
    if (!highestMargin || m > highestMargin.margin_percentage) {
      highestMargin = { source, margin_percentage: m };
    }
  }

  const rows: RevenueAttributionDashboardRow[] = Array.from(byKey.values())
    .map((bucket) => {
      const dominantConfidence = (Object.entries(bucket.confidenceCounts).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] ?? "inferred") as FiRevenueAttributionConfidence;
      return {
        source: bucket.source,
        campaign: bucket.campaign,
        leads: bucket.leadIds.size,
        consults: bucket.consultIds.size,
        invoices: bucket.invoiceIds.size,
        collected_revenue_cents: bucket.collected,
        gross_profit_cents: bucket.profit,
        margin_percentage: marginPct(bucket.collected, bucket.profit),
        confidence: dominantConfidence,
      };
    })
    .sort((a, b) => b.collected_revenue_cents - a.collected_revenue_cents);

  return {
    metrics: {
      revenue_by_source: FI_REVENUE_ATTRIBUTION_SOURCES.map((source) => ({
        source,
        cents: revenueBySource.get(source) ?? 0,
      })).filter((x) => x.cents > 0),
      gross_profit_by_source: FI_REVENUE_ATTRIBUTION_SOURCES.map((source) => ({
        source,
        cents: profitBySource.get(source) ?? 0,
      })).filter((x) => x.cents > 0),
      best_converting_source: bestConverting,
      highest_margin_source: highestMargin,
      unknown_attribution_percentage:
        totalCollected > 0 ? Math.round((unknownCollected / totalCollected) * 10_000) / 100 : 0,
    },
    rows,
  };
}

/** Tenant isolation guard for attribution event batches. */
export function assertRevenueAttributionEventsTenantScoped(
  tenantId: string,
  events: Array<{ tenant_id: string }>
): void {
  const tid = tenantId.trim();
  for (const ev of events) {
    if (ev.tenant_id.trim() !== tid) {
      throw new Error("Revenue attribution events must be tenant-scoped.");
    }
  }
}

export const FI_REVENUE_ATTRIBUTION_EVENTS_APPEND_ONLY = true as const;

export type FiRevenueAttributionEventRow = {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  lead_id: string | null;
  case_id: string | null;
  consultation_id: string | null;
  surgery_id: string | null;
  invoice_id: string | null;
  payment_id: string | null;
  transaction_id: string | null;
  attribution_source: FiRevenueAttributionSource;
  campaign_name: string | null;
  campaign_id: string | null;
  ad_group: string | null;
  keyword: string | null;
  referral_contact_id: string | null;
  consultant_fi_user_id: string | null;
  clinic_id: string | null;
  attributed_revenue_cents: number;
  attributed_collected_cents: number;
  gross_profit_cents: number | null;
  attribution_confidence: FiRevenueAttributionConfidence;
  source_metadata: Record<string, unknown>;
  idempotency_key: string | null;
  occurred_at: string;
  created_at: string;
};

export type FiRevenueAttributionManualOverrideRow = {
  id: string;
  tenant_id: string;
  case_id: string;
  attribution_source: FiRevenueAttributionSource | null;
  campaign_name: string | null;
  campaign_id: string | null;
  consultant_fi_user_id: string | null;
  updated_by_fi_user_id: string | null;
  updated_at: string;
};

export type RevenueAttributionDashboardFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  source?: string | null;
  campaign?: string | null;
  consultantFiUserId?: string | null;
  clinicId?: string | null;
  procedureType?: string | null;
};

export type RevenueAttributionDashboardPayload = {
  tenantId: string;
  currency: string;
  filters: RevenueAttributionDashboardFilters;
  metrics: RevenueAttributionDashboardMetrics;
  rows: RevenueAttributionDashboardRow[];
  recentEvents: FiRevenueAttributionEventRow[];
};
