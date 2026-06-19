import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isMissingDatabaseRelationError } from "@/src/lib/receptionOs/receptionOsLoaderResilience";
import {
  aggregateExecutiveAccountsReceivable,
  aggregateExecutiveAttribution,
  assertExecutiveDataTenantScoped,
  buildExecutiveFinanceSnapshot,
  compareExecutivePeriods,
  executiveZeroDataSnapshot,
  generateExecutiveFinanceInsights,
  mapExecutiveSnapshotRow,
  monthPeriodForYmd,
  previousMonthPeriod,
  type ExecutiveAttributionAggregation,
  type ExecutiveFinanceInsight,
  type ExecutivePeriodComparison,
  type FiFinancialExecutiveSnapshotRow,
} from "@/src/lib/financialOs/financialExecutiveIntelligenceCore";
import { mapFinancialTransactionRow } from "@/src/lib/financialOs/financialTransactionCore";
import { mapProfitabilitySnapshotRow } from "@/src/lib/financialOs/financialSurgeryEconomicsCore";
import { mapAccountsReceivableCaseRow } from "@/src/lib/financialOs/financialAccountsReceivableCore";
import type { FiRevenueAttributionSource } from "@/src/lib/financialOs/financialRevenueAttributionCore";
import { mapInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import { invoiceBalanceDueCents } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type ExecutiveFinanceDashboardFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  clinicId?: string | null;
  procedureType?: string | null;
  source?: string | null;
  consultantFiUserId?: string | null;
};

export type ExecutiveFinancePulsePayload = {
  tenantId: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  snapshot: Omit<FiFinancialExecutiveSnapshotRow, "id"> & { id?: string };
  comparison: ExecutivePeriodComparison;
  insights: ExecutiveFinanceInsight[];
};

export type ExecutiveFinanceDetailPayload = ExecutiveFinancePulsePayload & {
  filters: ExecutiveFinanceDashboardFilters;
  previousSnapshot: FiFinancialExecutiveSnapshotRow | null;
  attribution: ExecutiveAttributionAggregation;
  snapshotHistory: FiFinancialExecutiveSnapshotRow[];
};

function resolvePeriod(filters?: ExecutiveFinanceDashboardFilters, asOf = new Date()): {
  period_start: string;
  period_end: string;
  as_of_ymd: string;
} {
  const as_of_ymd = asOf.toISOString().slice(0, 10);
  if (filters?.dateFrom?.trim() && filters?.dateTo?.trim()) {
    return { period_start: filters.dateFrom.trim(), period_end: filters.dateTo.trim(), as_of_ymd };
  }
  const month = monthPeriodForYmd(as_of_ymd);
  return { ...month, as_of_ymd };
}

async function loadExecutiveLedgerTransactions(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  clinicId?: string | null,
  client?: SupabaseClient,
) {
  const supabase = client ?? supabaseAdmin();
  const startIso = `${periodStart}T00:00:00.000Z`;
  const endIso = `${periodEnd}T23:59:59.999Z`;

  let q = supabase
    .from("fi_financial_transactions")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .limit(5000);
  if (clinicId?.trim()) q = q.eq("clinic_id", clinicId.trim());

  const { data, error } = await q;
  if (error) {
    if (isMissingDatabaseRelationError(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => {
    const row = mapFinancialTransactionRow(r as Record<string, unknown>);
    return {
      tenant_id: row.tenant_id,
      transaction_kind: row.transaction_kind,
      amount_cents: row.amount_cents,
      direction: row.direction,
      invoice_id: row.invoice_id,
      consultation_id: row.consultation_id,
      case_id: row.case_id,
      clinic_id: row.clinic_id,
      created_at: row.created_at,
    };
  });
}

async function loadExecutiveInvoices(
  tenantId: string,
  periodStart: string,
  clinicId?: string | null,
  client?: SupabaseClient,
) {
  const supabase = client ?? supabaseAdmin();
  let q = supabase.from("fi_invoices").select("*").eq("tenant_id", tenantId).limit(5000);
  if (clinicId?.trim()) q = q.eq("clinic_id", clinicId.trim());

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const inv = mapInvoiceRow(r as Record<string, unknown>);
    return {
      id: inv.id,
      tenant_id: inv.tenant_id,
      invoice_kind: inv.invoice_kind,
      total_cents: inv.total_cents,
      remaining_balance_cents: inv.remaining_balance_cents ?? invoiceBalanceDueCents(inv),
      status: inv.status,
      days_overdue: inv.days_overdue,
      clinic_id: inv.clinic_id ?? null,
      consultation_id: inv.consultation_id ?? null,
      case_id: inv.case_id ?? null,
      created_at: inv.created_at,
      paid_at: inv.paid_at ?? null,
    };
  });
}

async function loadExecutiveProfitabilitySnapshots(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  filters?: ExecutiveFinanceDashboardFilters,
  client?: SupabaseClient,
) {
  const supabase = client ?? supabaseAdmin();
  const startIso = `${periodStart}T00:00:00.000Z`;
  const endIso = `${periodEnd}T23:59:59.999Z`;

  let q = supabase
    .from("fi_surgery_profitability_snapshots")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("calculated_at", startIso)
    .lte("calculated_at", endIso)
    .limit(2000);

  if (filters?.procedureType?.trim()) {
    q = q.ilike("procedure_type", filters.procedureType.trim());
  }

  const { data, error } = await q;
  if (error) {
    if (isMissingDatabaseRelationError(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => {
    const snap = mapProfitabilitySnapshotRow(r as Record<string, unknown>);
    const clinicId =
      typeof snap.source_metadata.clinic_id === "string" ? snap.source_metadata.clinic_id : null;
    return {
      tenant_id: snap.tenant_id,
      case_id: snap.case_id,
      procedure_type: snap.procedure_type,
      revenue_cents: snap.revenue_cents,
      collected_cents: snap.collected_cents,
      outstanding_cents: snap.outstanding_cents,
      gross_profit_cents: snap.gross_profit_cents,
      gross_margin_percentage: snap.gross_margin_percentage,
      graft_count: snap.graft_count,
      revenue_per_graft_cents: snap.revenue_per_graft_cents,
      calculated_at: snap.calculated_at,
      clinic_id: clinicId,
    };
  }).filter((s) => !filters?.clinicId?.trim() || s.clinic_id === filters.clinicId.trim());
}

async function loadExecutiveAttributionEvents(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  filters?: ExecutiveFinanceDashboardFilters,
  client?: SupabaseClient,
) {
  const supabase = client ?? supabaseAdmin();
  const startIso = `${periodStart}T00:00:00.000Z`;
  const endIso = `${periodEnd}T23:59:59.999Z`;

  let q = supabase
    .from("fi_revenue_attribution_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("occurred_at", startIso)
    .lte("occurred_at", endIso)
    .limit(5000);

  if (filters?.source?.trim()) q = q.eq("attribution_source", filters.source.trim());
  if (filters?.consultantFiUserId?.trim()) q = q.eq("consultant_fi_user_id", filters.consultantFiUserId.trim());
  if (filters?.clinicId?.trim()) q = q.eq("clinic_id", filters.clinicId.trim());

  const { data, error } = await q;
  if (error) {
    if (isMissingDatabaseRelationError(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => {
    const raw = r as Record<string, unknown>;
    const meta =
      raw.source_metadata && typeof raw.source_metadata === "object" && !Array.isArray(raw.source_metadata)
        ? (raw.source_metadata as Record<string, unknown>)
        : {};
    const procedureType = typeof meta.procedure_type === "string" ? meta.procedure_type : null;
    if (filters?.procedureType?.trim() && procedureType?.toLowerCase() !== filters.procedureType.trim().toLowerCase()) {
      return null;
    }
    return {
      tenant_id: String(raw.tenant_id),
      attribution_source: String(raw.attribution_source) as FiRevenueAttributionSource,
      attributed_revenue_cents: Number(raw.attributed_revenue_cents ?? 0),
      attributed_collected_cents: Number(raw.attributed_collected_cents ?? 0),
      gross_profit_cents: raw.gross_profit_cents != null ? Number(raw.gross_profit_cents) : null,
      lead_id: raw.lead_id != null ? String(raw.lead_id) : null,
      consultation_id: raw.consultation_id != null ? String(raw.consultation_id) : null,
      invoice_id: raw.invoice_id != null ? String(raw.invoice_id) : null,
      procedure_type: procedureType,
      clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
      consultant_fi_user_id: raw.consultant_fi_user_id != null ? String(raw.consultant_fi_user_id) : null,
      occurred_at: String(raw.occurred_at ?? ""),
    };
  }).filter((x): x is NonNullable<typeof x> => x != null);
}

async function loadExecutiveArCases(tenantId: string, clinicId?: string | null, client?: SupabaseClient) {
  const supabase = client ?? supabaseAdmin();
  let q = supabase.from("fi_accounts_receivable_cases").select("*").eq("tenant_id", tenantId).limit(2000);
  if (clinicId?.trim()) q = q.eq("clinic_id", clinicId.trim());

  const { data, error } = await q;
  if (error) {
    if (isMissingDatabaseRelationError(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => {
    const row = mapAccountsReceivableCaseRow(r as Record<string, unknown>);
    return {
      tenant_id: row.tenant_id,
      outstanding_amount_cents: row.outstanding_amount_cents,
      days_overdue: row.days_overdue,
      risk_level: row.risk_level,
      receivable_type: row.receivable_type,
      status: row.status,
      clinic_id: row.clinic_id,
    };
  });
}

async function loadScheduledSurgeriesForForecast(
  tenantId: string,
  periodEnd: string,
  asOfYmd: string,
  clinicId?: string | null,
  client?: SupabaseClient,
) {
  const supabase = client ?? supabaseAdmin();
  let q = supabase
    .from("fi_surgeries")
    .select("id, case_id, scheduled_date, tenant_id")
    .eq("tenant_id", tenantId)
    .gte("scheduled_date", asOfYmd)
    .lte("scheduled_date", periodEnd)
    .limit(500);

  const { data, error } = await q;
  if (error) {
    if (isMissingDatabaseRelationError(error)) return [];
    throw new Error(error.message);
  }

  const surgeries = (data ?? []) as Array<{ id: string; case_id: string | null; scheduled_date: string }>;
  const caseIds = [...new Set(surgeries.map((s) => s.case_id).filter(Boolean))] as string[];
  if (!caseIds.length) return [];

  let invQ = supabase
    .from("fi_invoices")
    .select("case_id, total_cents, remaining_balance_cents, clinic_id, invoice_kind")
    .eq("tenant_id", tenantId)
    .in("case_id", caseIds)
    .in("invoice_kind", ["surgery_deposit", "surgery_balance"]);

  const { data: invData, error: invErr } = await invQ;
  if (invErr) return [];

  const invoiceByCase = new Map<string, number>();
  for (const inv of invData ?? []) {
    const raw = inv as { case_id: string; total_cents?: number; remaining_balance_cents?: number; clinic_id?: string | null };
    if (clinicId?.trim() && raw.clinic_id !== clinicId.trim()) continue;
    const value = Math.max(0, Number(raw.remaining_balance_cents ?? raw.total_cents ?? 0));
    invoiceByCase.set(raw.case_id, (invoiceByCase.get(raw.case_id) ?? 0) + value);
  }

  return surgeries.map((s) => ({
    surgery_id: s.id,
    scheduled_date: String(s.scheduled_date).slice(0, 10),
    invoice_value_cents: s.case_id ? (invoiceByCase.get(s.case_id) ?? 0) : 0,
    clinic_id: clinicId?.trim() || null,
  }));
}

export async function loadLatestExecutiveSnapshot(
  tenantId: string,
  clinicId?: string | null,
  client?: SupabaseClient,
): Promise<FiFinancialExecutiveSnapshotRow | null> {
  const supabase = client ?? supabaseAdmin();
  let q = supabase
    .from("fi_financial_executive_snapshots")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .order("calculated_at", { ascending: false })
    .limit(1);

  if (clinicId?.trim()) {
    q = q.eq("clinic_id", clinicId.trim());
  } else {
    q = q.is("clinic_id", null);
  }

  const { data, error } = await q.maybeSingle();
  if (error) {
    if (isMissingDatabaseRelationError(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapExecutiveSnapshotRow(data as Record<string, unknown>);
}

export async function loadExecutiveSnapshotForPeriod(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  clinicId?: string | null,
  client?: SupabaseClient,
): Promise<FiFinancialExecutiveSnapshotRow | null> {
  const supabase = client ?? supabaseAdmin();
  let q = supabase
    .from("fi_financial_executive_snapshots")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .order("calculated_at", { ascending: false })
    .limit(1);

  if (clinicId?.trim()) q = q.eq("clinic_id", clinicId.trim());
  else q = q.is("clinic_id", null);

  const { data, error } = await q.maybeSingle();
  if (error) {
    if (isMissingDatabaseRelationError(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapExecutiveSnapshotRow(data as Record<string, unknown>);
}

export async function persistExecutiveFinanceSnapshot(
  snapshot: Omit<FiFinancialExecutiveSnapshotRow, "id">,
  client?: SupabaseClient,
): Promise<FiFinancialExecutiveSnapshotRow> {
  const supabase = client ?? supabaseAdmin();
  const row = {
    tenant_id: snapshot.tenant_id,
    clinic_id: snapshot.clinic_id,
    period_start: snapshot.period_start,
    period_end: snapshot.period_end,
    gross_revenue_cents: snapshot.gross_revenue_cents,
    collected_revenue_cents: snapshot.collected_revenue_cents,
    outstanding_revenue_cents: snapshot.outstanding_revenue_cents,
    overdue_revenue_cents: snapshot.overdue_revenue_cents,
    surgery_revenue_cents: snapshot.surgery_revenue_cents,
    treatment_revenue_cents: snapshot.treatment_revenue_cents,
    gross_profit_cents: snapshot.gross_profit_cents,
    average_margin_percentage: snapshot.average_margin_percentage,
    average_revenue_per_case_cents: snapshot.average_revenue_per_case_cents,
    average_revenue_per_graft_cents: snapshot.average_revenue_per_graft_cents,
    total_surgeries: snapshot.total_surgeries,
    total_consults: snapshot.total_consults,
    total_paid_invoices: snapshot.total_paid_invoices,
    total_overdue_invoices: snapshot.total_overdue_invoices,
    best_revenue_source: snapshot.best_revenue_source,
    best_profit_source: snapshot.best_profit_source,
    highest_margin_procedure_type: snapshot.highest_margin_procedure_type,
    ar_risk_score: snapshot.ar_risk_score,
    forecast_revenue_cents: snapshot.forecast_revenue_cents,
    forecast_confidence: snapshot.forecast_confidence,
    source_metadata: snapshot.source_metadata,
    calculated_at: snapshot.calculated_at,
  };

  const { data, error } = await supabase.from("fi_financial_executive_snapshots").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return mapExecutiveSnapshotRow(data as Record<string, unknown>);
}

export async function buildAndPersistExecutiveSnapshot(
  tenantId: string,
  filters?: ExecutiveFinanceDashboardFilters,
  asOf = new Date(),
  options?: { skipPersist?: boolean },
): Promise<Omit<FiFinancialExecutiveSnapshotRow, "id">> {
  const tid = tenantId.trim();
  const { period_start, period_end, as_of_ymd } = resolvePeriod(filters, asOf);
  const clinicId = filters?.clinicId ?? null;

  const [ledger, invoices, profitability, attribution, arCases, scheduled] = await Promise.all([
    loadExecutiveLedgerTransactions(tid, period_start, period_end, clinicId),
    loadExecutiveInvoices(tid, period_start, clinicId),
    loadExecutiveProfitabilitySnapshots(tid, period_start, period_end, filters),
    loadExecutiveAttributionEvents(tid, period_start, period_end, filters),
    loadExecutiveArCases(tid, clinicId),
    loadScheduledSurgeriesForForecast(tid, period_end, as_of_ymd, clinicId),
  ]);

  assertExecutiveDataTenantScoped(tid, [
    ...ledger,
    ...invoices,
    ...profitability,
    ...attribution,
    ...arCases,
  ]);

  const snapshot = buildExecutiveFinanceSnapshot({
    tenant_id: tid,
    clinic_id: clinicId,
    period_start,
    period_end,
    as_of_ymd,
    ledger_transactions: ledger,
    invoices,
    profitability_snapshots: profitability,
    attribution_events: attribution,
    ar_cases: arCases,
    scheduled_surgeries: scheduled,
  });

  if (!options?.skipPersist) {
    try {
      await persistExecutiveFinanceSnapshot(snapshot);
    } catch (e) {
      if (!isMissingDatabaseRelationError(e)) throw e;
    }
  }

  return snapshot;
}

export async function loadExecutiveFinancePulsePayload(
  tenantId: string,
  filters?: ExecutiveFinanceDashboardFilters,
  asOf = new Date(),
): Promise<ExecutiveFinancePulsePayload> {
  const detail = await loadExecutiveFinanceDetailPayload(tenantId, filters, asOf);
  return {
    tenantId: detail.tenantId,
    currency: detail.currency,
    periodStart: detail.periodStart,
    periodEnd: detail.periodEnd,
    snapshot: detail.snapshot,
    comparison: detail.comparison,
    insights: detail.insights,
  };
}

export async function loadExecutiveFinanceDetailPayload(
  tenantId: string,
  filters?: ExecutiveFinanceDashboardFilters,
  asOf = new Date(),
): Promise<ExecutiveFinanceDetailPayload> {
  const tid = tenantId.trim();
  const { period_start, period_end, as_of_ymd } = resolvePeriod(filters, asOf);
  const clinicId = filters?.clinicId ?? null;

  const [ledger, invoices, profitability, attributionEvents, arCases, scheduled] = await Promise.all([
    loadExecutiveLedgerTransactions(tid, period_start, period_end, clinicId),
    loadExecutiveInvoices(tid, period_start, clinicId),
    loadExecutiveProfitabilitySnapshots(tid, period_start, period_end, filters),
    loadExecutiveAttributionEvents(tid, period_start, period_end, filters),
    loadExecutiveArCases(tid, clinicId),
    loadScheduledSurgeriesForForecast(tid, period_end, as_of_ymd, clinicId),
  ]);

  assertExecutiveDataTenantScoped(tid, [...ledger, ...invoices, ...profitability, ...attributionEvents, ...arCases]);

  let snapshot: Omit<FiFinancialExecutiveSnapshotRow, "id">;
  try {
    snapshot = buildExecutiveFinanceSnapshot({
      tenant_id: tid,
      clinic_id: clinicId,
      period_start,
      period_end,
      as_of_ymd,
      ledger_transactions: ledger,
      invoices,
      profitability_snapshots: profitability,
      attribution_events: attributionEvents,
      ar_cases: arCases,
      scheduled_surgeries: scheduled,
    });
    try {
      await persistExecutiveFinanceSnapshot(snapshot);
    } catch (e) {
      if (!isMissingDatabaseRelationError(e)) throw e;
    }
  } catch {
    snapshot = executiveZeroDataSnapshot(tid, period_start, period_end);
  }

  const attribution = aggregateExecutiveAttribution({
    period_start,
    period_end,
    events: attributionEvents,
  });

  const prevPeriod = previousMonthPeriod(period_start);
  let previousSnapshot: FiFinancialExecutiveSnapshotRow | null = null;
  try {
    previousSnapshot = await loadExecutiveSnapshotForPeriod(tid, prevPeriod.period_start, prevPeriod.period_end, clinicId);
  } catch {
    previousSnapshot = null;
  }

  const comparison = compareExecutivePeriods(snapshot, previousSnapshot);
  const ar = aggregateExecutiveAccountsReceivable(arCases);

  const insights = generateExecutiveFinanceInsights({
    snapshot,
    attribution,
    ar,
    profitability_snapshots: profitability,
    comparison,
  });

  let snapshotHistory: FiFinancialExecutiveSnapshotRow[] = [];
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_financial_executive_snapshots")
      .select("*")
      .eq("tenant_id", tid)
      .order("calculated_at", { ascending: false })
      .limit(24);
    if (!error && data) {
      snapshotHistory = data.map((r) => mapExecutiveSnapshotRow(r as Record<string, unknown>));
    }
  } catch {
    snapshotHistory = [];
  }

  return {
    tenantId: tid,
    currency: "AUD",
    periodStart: period_start,
    periodEnd: period_end,
    snapshot,
    comparison,
    insights,
    filters: filters ?? {},
    previousSnapshot,
    attribution,
    snapshotHistory,
  };
}

export async function loadExecutiveFinanceFilterOptions(tenantId: string): Promise<{
  clinicOptions: Array<{ value: string; label: string }>;
  procedureTypes: string[];
  sources: string[];
  consultantOptions: Array<{ value: string; label: string }>;
}> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  const { data: clinics } = await supabase.from("fi_clinics").select("id, name").eq("tenant_id", tid).order("name");
  const clinicOptions = (clinics ?? []).map((c) => {
    const raw = c as { id: string; name?: string | null };
    return { value: raw.id, label: raw.name?.trim() || raw.id.slice(0, 8) };
  });

  const procedureTypes = new Set<string>();
  try {
    const { data: snaps } = await supabase
      .from("fi_surgery_profitability_snapshots")
      .select("procedure_type")
      .eq("tenant_id", tid)
      .limit(500);
    for (const s of snaps ?? []) {
      const pt = (s as { procedure_type?: string }).procedure_type?.trim();
      if (pt) procedureTypes.add(pt);
    }
  } catch {
    // optional table
  }

  const consultantIds = new Set<string>();
  try {
    const { data: events } = await supabase
      .from("fi_revenue_attribution_events")
      .select("consultant_fi_user_id")
      .eq("tenant_id", tid)
      .not("consultant_fi_user_id", "is", null)
      .limit(500);
    for (const e of events ?? []) {
      const id = (e as { consultant_fi_user_id?: string }).consultant_fi_user_id;
      if (id) consultantIds.add(id);
    }
  } catch {
    // optional table
  }

  const userLabels = new Map<string, string>();
  if (consultantIds.size) {
    const { data: users } = await supabase
      .from("fi_users")
      .select("id, display_name, email")
      .eq("tenant_id", tid)
      .in("id", [...consultantIds]);
    for (const u of users ?? []) {
      const raw = u as { id: string; display_name?: string | null; email?: string | null };
      userLabels.set(raw.id, raw.display_name?.trim() || raw.email?.trim() || raw.id.slice(0, 8));
    }
  }

  return {
    clinicOptions,
    procedureTypes: [...procedureTypes].sort(),
    sources: [
      "google_ads",
      "meta_ads",
      "organic",
      "referral",
      "ambassador",
      "existing_patient",
      "direct",
      "unknown",
    ],
    consultantOptions: [...consultantIds].map((id) => ({ value: id, label: userLabels.get(id) ?? id })),
  };
}
