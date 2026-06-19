import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import type { CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import {
  aggregateSurgeryEconomicsDashboardMetrics,
  buildProfitabilitySnapshotInsertRow,
  calculateSurgeryProfitability,
  defaultCostModelForProcedure,
  mapProfitabilitySnapshotRow,
  type FiSurgeryCostModel,
  type FiSurgeryProfitabilitySnapshotRow,
  type SurgeryEconomicsDashboardMetrics,
  type SurgeryEconomicsProfitabilityResult,
  type SurgeryEconomicsTreatmentAddons,
} from "@/src/lib/financialOs/financialSurgeryEconomicsCore";
import type { CasePaymentReadiness } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import { invoiceBalanceDueCents, type FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type SurgeryEconomicsCaseSummary = {
  financialDataAvailable: boolean;
  procedure_type: string | null;
  invoice_total_cents: number;
  collected_cents: number;
  outstanding_cents: number;
  estimated_total_cost_cents: number;
  estimated_gross_profit_cents: number;
  estimated_gross_margin_percentage: number;
  snapshot_status: "none" | "snapshot" | "estimate";
  latest_snapshot: FiSurgeryProfitabilitySnapshotRow | null;
  estimate: SurgeryEconomicsProfitabilityResult | null;
  currency: string;
};

export type SurgeryEconomicsDashboardFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  procedureType?: string | null;
  surgeonUserId?: string | null;
  clinicId?: string | null;
  snapshotStatus?: "all" | "paid_in_full" | "outstanding" | "needs_configuration";
};

export type SurgeryEconomicsDashboardPayload = {
  metrics: SurgeryEconomicsDashboardMetrics;
  recentSnapshots: Array<
    FiSurgeryProfitabilitySnapshotRow & {
      patient_label: string | null;
    }
  >;
  currency: string;
};

function mapCostModelRow(raw: Record<string, unknown>): FiSurgeryCostModel {
  return {
    id: raw.id != null ? String(raw.id) : undefined,
    tenant_id: String(raw.tenant_id),
    procedure_type: String(raw.procedure_type ?? "").trim().toLowerCase(),
    surgeon_cost_type: String(raw.surgeon_cost_type ?? "fixed") as FiSurgeryCostModel["surgeon_cost_type"],
    surgeon_cost_value_cents: Number(raw.surgeon_cost_value_cents ?? 0),
    rn_hourly_rate_cents: Number(raw.rn_hourly_rate_cents ?? 0),
    technician_hourly_rate_cents: Number(raw.technician_hourly_rate_cents ?? 0),
    assistant_hourly_rate_cents: Number(raw.assistant_hourly_rate_cents ?? 0),
    room_hourly_cost_cents: Number(raw.room_hourly_cost_cents ?? 0),
    consumables_base_cost_cents: Number(raw.consumables_base_cost_cents ?? 0),
    graft_consumable_cost_cents: Number(raw.graft_consumable_cost_cents ?? 0),
    prp_cost_cents: Number(raw.prp_cost_cents ?? 0),
    exosome_cost_cents: Number(raw.exosome_cost_cents ?? 0),
    medication_cost_cents: Number(raw.medication_cost_cents ?? 0),
    default_duration_minutes: Number(raw.default_duration_minutes ?? 480),
    is_active: Boolean(raw.is_active ?? true),
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
    archived_at: raw.archived_at != null ? String(raw.archived_at) : null,
    created_by_fi_user_id: raw.created_by_fi_user_id != null ? String(raw.created_by_fi_user_id) : null,
  };
}

export { mapCostModelRow };

export async function loadActiveSurgeryCostModel(
  tenantId: string,
  procedureType: string,
  client?: SupabaseClient
): Promise<FiSurgeryCostModel | null> {
  const tid = tenantId.trim();
  const proc = procedureType.trim().toLowerCase();
  if (!tid || !proc) return null;

  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_cost_models")
    .select("*")
    .eq("tenant_id", tid)
    .eq("is_active", true)
    .ilike("procedure_type", proc)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapCostModelRow(data as Record<string, unknown>);
}

export function surgeryInvoicesFromReadiness(readiness: CasePaymentReadiness): FiInvoiceRow[] {
  return readiness.invoices.filter((inv) => inv.invoice_kind === "surgery_deposit" || inv.invoice_kind === "surgery_balance");
}

export function aggregateSurgeryInvoiceRevenue(invoices: FiInvoiceRow[]): {
  revenue_cents: number;
  collected_cents: number;
  outstanding_cents: number;
  primary_invoice_id: string | null;
  currency: string;
} {
  let revenue = 0;
  let collected = 0;
  let outstanding = 0;
  let primaryInvoiceId: string | null = null;
  let currency = "AUD";

  for (const inv of invoices) {
    revenue += Math.max(0, inv.total_cents);
    collected += Math.max(0, inv.amount_paid_cents);
    outstanding += Math.max(0, inv.remaining_balance_cents ?? invoiceBalanceDueCents(inv));
    currency = inv.currency || currency;
    if (inv.invoice_kind === "surgery_balance") primaryInvoiceId = inv.id;
  }
  if (!primaryInvoiceId && invoices.length) {
    primaryInvoiceId = invoices[0]?.id ?? null;
  }

  return {
    revenue_cents: revenue,
    collected_cents: collected,
    outstanding_cents: outstanding,
    primary_invoice_id: primaryInvoiceId,
    currency,
  };
}

export function resolveProcedureType(args: {
  surgeryPlan: CaseSurgeryPlanRow | null;
  procedureDay: CaseProcedureRow | null;
  fallback?: string | null;
}): string | null {
  const fromPlan = args.surgeryPlan?.planned_procedure_type?.trim();
  if (fromPlan) return fromPlan;
  const extraction = args.procedureDay?.extraction_method?.trim();
  if (extraction) return extraction;
  const implant = args.procedureDay?.implantation_method?.trim();
  if (implant) return implant;
  return args.fallback?.trim() || null;
}

export function resolveGraftAndHairCounts(args: {
  procedureDay: CaseProcedureRow | null;
  surgeryPlan: CaseSurgeryPlanRow | null;
  liveGraftCount?: number | null;
  liveHairCount?: number | null;
}): { graft_count: number | null; hair_count: number | null } {
  if (args.liveGraftCount != null && args.liveGraftCount > 0) {
    return {
      graft_count: Math.floor(args.liveGraftCount),
      hair_count: args.liveHairCount != null ? Math.floor(args.liveHairCount) : null,
    };
  }
  const implanted = args.procedureDay?.grafts_implanted;
  if (implanted != null && implanted > 0) {
    return {
      graft_count: Math.floor(implanted),
      hair_count: args.procedureDay?.hairs_implanted != null ? Math.floor(args.procedureDay.hairs_implanted) : null,
    };
  }
  const extracted = args.procedureDay?.grafts_extracted;
  if (extracted != null && extracted > 0) {
    return {
      graft_count: Math.floor(extracted),
      hair_count: args.procedureDay?.hairs_implanted != null ? Math.floor(args.procedureDay.hairs_implanted) : null,
    };
  }
  const min = args.surgeryPlan?.estimated_grafts_min;
  const max = args.surgeryPlan?.estimated_grafts_max;
  if (min != null && max != null && max > 0) {
    return { graft_count: Math.floor((min + max) / 2), hair_count: null };
  }
  if (max != null && max > 0) return { graft_count: Math.floor(max), hair_count: null };
  if (min != null && min > 0) return { graft_count: Math.floor(min), hair_count: null };
  return { graft_count: null, hair_count: null };
}

export function resolveDurationMinutes(args: {
  procedureDay: CaseProcedureRow | null;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  defaultDurationMinutes: number;
}): number {
  const start = args.procedureDay?.start_time?.trim() || args.actualStartAt?.trim() || null;
  const end = args.procedureDay?.finish_time?.trim() || args.actualEndAt?.trim() || null;
  if (start && end) {
    const ms = Date.parse(end) - Date.parse(start);
    if (Number.isFinite(ms) && ms > 0) return Math.max(1, Math.round(ms / 60_000));
  }
  return Math.max(1, Math.floor(args.defaultDurationMinutes));
}

export function resolveStaffCounts(procedureDay: CaseProcedureRow | null): {
  rn_count: number;
  technician_count: number;
  assistant_count: number;
} {
  if (!procedureDay) return { rn_count: 0, technician_count: 0, assistant_count: 0 };
  const surgeonId = procedureDay.surgeon_user_id?.trim() || null;
  const nurseId = procedureDay.nurse_user_id?.trim() || null;
  const techIds = new Set(procedureDay.technician_user_ids.map((id) => id.trim()).filter(Boolean));
  const assistants = new Set<string>();
  for (const id of procedureDay.team_member_user_ids) {
    const tid = id.trim();
    if (!tid || tid === surgeonId || tid === nurseId || techIds.has(tid)) continue;
    assistants.add(tid);
  }
  return {
    rn_count: nurseId ? 1 : 0,
    technician_count: techIds.size,
    assistant_count: assistants.size,
  };
}

export function resolveTreatmentAddonsFromChecklist(checklist: Record<string, unknown> | null | undefined): SurgeryEconomicsTreatmentAddons {
  const c = checklist ?? {};
  return {
    prp: Boolean(c.prp_prepared),
    exosome: Boolean(c.exosomes_prepared),
  };
}

export function buildSurgeryEconomicsCalculationInput(args: {
  tenantId: string;
  procedureType: string;
  costModel: FiSurgeryCostModel;
  revenue: { revenue_cents: number; collected_cents: number; outstanding_cents: number };
  procedureDay: CaseProcedureRow | null;
  surgeryPlan: CaseSurgeryPlanRow | null;
  treatmentAddons?: SurgeryEconomicsTreatmentAddons;
  liveGraftCount?: number | null;
  liveHairCount?: number | null;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
}) {
  const { graft_count, hair_count } = resolveGraftAndHairCounts({
    procedureDay: args.procedureDay,
    surgeryPlan: args.surgeryPlan,
    liveGraftCount: args.liveGraftCount,
    liveHairCount: args.liveHairCount,
  });
  return {
    tenant_id: args.tenantId.trim(),
    procedure_type: args.procedureType,
    cost_model: args.costModel,
    revenue: args.revenue,
    duration_minutes: resolveDurationMinutes({
      procedureDay: args.procedureDay,
      actualStartAt: args.actualStartAt,
      actualEndAt: args.actualEndAt,
      defaultDurationMinutes: args.costModel.default_duration_minutes,
    }),
    staff_counts: resolveStaffCounts(args.procedureDay),
    treatment_addons: args.treatmentAddons ?? { prp: false, exosome: false },
    graft_count,
    hair_count,
  };
}

export async function appendSurgeryProfitabilityAuditEvent(args: {
  tenantId: string;
  snapshotId: string;
  caseId?: string | null;
  surgeryId?: string | null;
  actorFiUserId?: string | null;
  payload?: Record<string, unknown>;
  client?: SupabaseClient;
}): Promise<void> {
  const supabase = args.client ?? supabaseAdmin();
  const { error } = await supabase.from("fi_financial_transaction_audit_events").insert({
    tenant_id: args.tenantId.trim(),
    financial_transaction_id: null,
    event_kind: "surgery_profitability_calculated",
    actor_fi_user_id: args.actorFiUserId?.trim() || null,
    payload: {
      snapshot_id: args.snapshotId,
      case_id: args.caseId?.trim() || null,
      surgery_id: args.surgeryId?.trim() || null,
      ...(args.payload ?? {}),
    },
  });
  if (error) throw new Error(error.message);
}

export async function calculateAndPersistSurgeryProfitabilitySnapshot(args: {
  tenantId: string;
  caseId: string;
  surgeryId?: string | null;
  patientId?: string | null;
  procedureType: string;
  costModel?: FiSurgeryCostModel | null;
  procedureDay: CaseProcedureRow | null;
  surgeryPlan: CaseSurgeryPlanRow | null;
  paymentReadiness: CasePaymentReadiness;
  treatmentAddons?: SurgeryEconomicsTreatmentAddons;
  liveGraftCount?: number | null;
  liveHairCount?: number | null;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  actorFiUserId?: string | null;
  sourceMetadata?: Record<string, unknown>;
  client?: SupabaseClient;
}): Promise<FiSurgeryProfitabilitySnapshotRow> {
  const tid = args.tenantId.trim();
  const cid = args.caseId.trim();
  const proc = args.procedureType.trim();
  if (!tid || !cid || !proc) throw new Error("tenantId, caseId, and procedureType are required.");

  const supabase = args.client ?? supabaseAdmin();
  const costModel =
    args.costModel ??
    (await loadActiveSurgeryCostModel(tid, proc, supabase)) ??
    (() => {
      throw new Error("No active cost model exists for this procedure type.");
    })();

  const surgeryInvoices = surgeryInvoicesFromReadiness(args.paymentReadiness);
  const revenueAgg = aggregateSurgeryInvoiceRevenue(surgeryInvoices);

  const calcInput = buildSurgeryEconomicsCalculationInput({
    tenantId: tid,
    procedureType: proc,
    costModel,
    revenue: revenueAgg,
    procedureDay: args.procedureDay,
    surgeryPlan: args.surgeryPlan,
    treatmentAddons: args.treatmentAddons,
    liveGraftCount: args.liveGraftCount,
    liveHairCount: args.liveHairCount,
    actualStartAt: args.actualStartAt,
    actualEndAt: args.actualEndAt,
  });

  const profitability = calculateSurgeryProfitability(calcInput);
  const insertRow = buildProfitabilitySnapshotInsertRow({
    tenantId: tid,
    caseId: cid,
    surgeryId: args.surgeryId ?? null,
    patientId: args.patientId ?? null,
    invoiceId: revenueAgg.primary_invoice_id,
    profitability,
    sourceMetadata: {
      cost_model_procedure_type: costModel.procedure_type,
      surgeon_cost_type: costModel.surgeon_cost_type,
      duration_minutes: calcInput.duration_minutes,
      staff_counts: calcInput.staff_counts,
      treatment_addons: calcInput.treatment_addons,
      invoice_count: surgeryInvoices.length,
      ...(args.sourceMetadata ?? {}),
    },
  });

  const { data, error } = await supabase
    .from("fi_surgery_profitability_snapshots")
    .insert(insertRow)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const snapshot = mapProfitabilitySnapshotRow(data as Record<string, unknown>);
  await appendSurgeryProfitabilityAuditEvent({
    tenantId: tid,
    snapshotId: snapshot.id ?? String((data as { id: string }).id),
    caseId: cid,
    surgeryId: args.surgeryId ?? null,
    actorFiUserId: args.actorFiUserId,
    payload: {
      gross_profit_cents: snapshot.gross_profit_cents,
      gross_margin_percentage: snapshot.gross_margin_percentage,
      procedure_type: snapshot.procedure_type,
    },
    client: supabase,
  });

  return snapshot;
}

export async function loadLatestProfitabilitySnapshotForCase(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<FiSurgeryProfitabilitySnapshotRow | null> {
  const tid = tenantId.trim();
  const cid = caseId.trim();
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_profitability_snapshots")
    .select("*")
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapProfitabilitySnapshotRow(data as Record<string, unknown>);
}

export async function loadCaseSurgeryEconomicsSummary(args: {
  tenantId: string;
  caseId: string;
  paymentReadiness: CasePaymentReadiness;
  surgeryPlan: CaseSurgeryPlanRow | null;
  procedureDay: CaseProcedureRow | null;
  surgeryId?: string | null;
  patientId?: string | null;
  liveGraftCount?: number | null;
  liveHairCount?: number | null;
  treatmentAddons?: SurgeryEconomicsTreatmentAddons;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
}): Promise<SurgeryEconomicsCaseSummary> {
  const tid = args.tenantId.trim();
  const cid = args.caseId.trim();

  try {
    const procedureType = resolveProcedureType({
      surgeryPlan: args.surgeryPlan,
      procedureDay: args.procedureDay,
    });
    const surgeryInvoices = surgeryInvoicesFromReadiness(args.paymentReadiness);
    const revenueAgg = aggregateSurgeryInvoiceRevenue(surgeryInvoices);
    const latestSnapshot = await loadLatestProfitabilitySnapshotForCase(tid, cid);

    if (!procedureType) {
      return {
        financialDataAvailable: surgeryInvoices.length > 0,
        procedure_type: null,
        invoice_total_cents: revenueAgg.revenue_cents,
        collected_cents: revenueAgg.collected_cents,
        outstanding_cents: revenueAgg.outstanding_cents,
        estimated_total_cost_cents: 0,
        estimated_gross_profit_cents: 0,
        estimated_gross_margin_percentage: 0,
        snapshot_status: latestSnapshot ? "snapshot" : "none",
        latest_snapshot: latestSnapshot,
        estimate: null,
        currency: revenueAgg.currency,
      };
    }

    const costModel = (await loadActiveSurgeryCostModel(tid, procedureType)) ?? defaultCostModelForProcedure(tid, procedureType);
    const calcInput = buildSurgeryEconomicsCalculationInput({
      tenantId: tid,
      procedureType,
      costModel,
      revenue: revenueAgg,
      procedureDay: args.procedureDay,
      surgeryPlan: args.surgeryPlan,
      treatmentAddons: args.treatmentAddons,
      liveGraftCount: args.liveGraftCount,
      liveHairCount: args.liveHairCount,
      actualStartAt: args.actualStartAt,
      actualEndAt: args.actualEndAt,
    });
    const estimate = calculateSurgeryProfitability(calcInput);

    return {
      financialDataAvailable: true,
      procedure_type: procedureType,
      invoice_total_cents: revenueAgg.revenue_cents,
      collected_cents: revenueAgg.collected_cents,
      outstanding_cents: revenueAgg.outstanding_cents,
      estimated_total_cost_cents: estimate.total_cost_cents,
      estimated_gross_profit_cents: estimate.gross_profit_cents,
      estimated_gross_margin_percentage: estimate.gross_margin_percentage,
      snapshot_status: latestSnapshot ? "snapshot" : "estimate",
      latest_snapshot: latestSnapshot,
      estimate,
      currency: revenueAgg.currency,
    };
  } catch {
    return {
      financialDataAvailable: false,
      procedure_type: null,
      invoice_total_cents: 0,
      collected_cents: 0,
      outstanding_cents: 0,
      estimated_total_cost_cents: 0,
      estimated_gross_profit_cents: 0,
      estimated_gross_margin_percentage: 0,
      snapshot_status: "none",
      latest_snapshot: null,
      estimate: null,
      currency: "AUD",
    };
  }
}

async function loadPatientLabelsForSnapshots(tenantId: string, patientIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(patientIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);

  const personIds = [...new Set((data ?? []).map((r) => String((r as { person_id: string }).person_id)))];
  const personMeta = new Map<string, Record<string, unknown>>();
  if (personIds.length) {
    const { data: persons, error: pe } = await supabase.from("fi_persons").select("id, metadata").in("id", personIds);
    if (pe) throw new Error(pe.message);
    for (const row of persons ?? []) {
      const id = String((row as { id: string }).id);
      const m = (row as { metadata: unknown }).metadata;
      personMeta.set(id, m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {});
    }
  }

  const out = new Map<string, string>();
  for (const raw of data ?? []) {
    const r = raw as { id: string; person_id: string };
    const label = personMetadataDisplayLabel(personMeta.get(String(r.person_id)) ?? {});
    if (label && label !== "—") out.set(String(r.id), label);
  }
  return out;
}

export async function loadSurgeryEconomicsDashboardPayload(
  tenantId: string,
  limit = 20,
  filters?: SurgeryEconomicsDashboardFilters
): Promise<SurgeryEconomicsDashboardPayload> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  let query = supabase.from("fi_surgery_profitability_snapshots").select("*").eq("tenant_id", tid);

  if (filters?.dateFrom?.trim()) {
    query = query.gte("calculated_at", `${filters.dateFrom.trim()}T00:00:00.000Z`);
  }
  if (filters?.dateTo?.trim()) {
    query = query.lte("calculated_at", `${filters.dateTo.trim()}T23:59:59.999Z`);
  }
  if (filters?.procedureType?.trim()) {
    query = query.ilike("procedure_type", filters.procedureType.trim());
  }
  if (filters?.snapshotStatus === "paid_in_full") {
    query = query.eq("outstanding_cents", 0);
  } else if (filters?.snapshotStatus === "outstanding") {
    query = query.gt("outstanding_cents", 0);
  }

  const { data: snapshotRaw, error } = await query.order("calculated_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);

  let snapshots = (snapshotRaw ?? []).map((r) => mapProfitabilitySnapshotRow(r as Record<string, unknown>));

  if (filters?.surgeonUserId?.trim()) {
    const surgeonId = filters.surgeonUserId.trim();
    snapshots = snapshots.filter((s) => String(s.source_metadata.surgeon_user_id ?? "") === surgeonId);
  }
  if (filters?.clinicId?.trim()) {
    const clinicId = filters.clinicId.trim();
    snapshots = snapshots.filter((s) => String(s.source_metadata.clinic_id ?? "") === clinicId);
  }

  const metrics = aggregateSurgeryEconomicsDashboardMetrics(snapshots);

  const patientIds = snapshots.map((s) => s.patient_id).filter((id): id is string => Boolean(id));
  const patientLabelById = await loadPatientLabelsForSnapshots(tid, patientIds);

  let currency = "AUD";
  if (snapshots.length) {
    const caseIds = [...new Set(snapshots.map((s) => s.case_id).filter((id): id is string => Boolean(id)))];
    if (caseIds.length) {
      const { data: invs } = await supabase
        .from("fi_invoices")
        .select("case_id, currency")
        .eq("tenant_id", tid)
        .in("case_id", caseIds.slice(0, 50))
        .limit(50);
      const first = (invs ?? [])[0] as { currency?: string } | undefined;
      if (first?.currency) currency = String(first.currency).toUpperCase();
    }
  }

  const recentSnapshots = snapshots.slice(0, limit).map((s) => ({
    ...s,
    patient_label: s.patient_id ? patientLabelById.get(s.patient_id) ?? null : null,
  }));

  return { metrics, recentSnapshots, currency };
}

export async function loadSurgeryEconomicsFilterOptions(tenantId: string): Promise<{
  procedureTypes: string[];
  surgeonOptions: Array<{ value: string; label: string }>;
  clinicOptions: Array<{ value: string; label: string }>;
}> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  const { data: snapshots } = await supabase
    .from("fi_surgery_profitability_snapshots")
    .select("procedure_type, source_metadata")
    .eq("tenant_id", tid)
    .limit(200);

  const procedureTypes = new Set<string>();
  const surgeonIds = new Set<string>();
  const clinicIds = new Set<string>();

  for (const row of snapshots ?? []) {
    const r = row as { procedure_type?: string; source_metadata?: Record<string, unknown> };
    if (r.procedure_type?.trim()) procedureTypes.add(r.procedure_type.trim().toLowerCase());
    const meta = r.source_metadata ?? {};
    const surgeon = meta.surgeon_user_id != null ? String(meta.surgeon_user_id).trim() : "";
    const clinic = meta.clinic_id != null ? String(meta.clinic_id).trim() : "";
    if (surgeon) surgeonIds.add(surgeon);
    if (clinic) clinicIds.add(clinic);
  }

  const { data: costModels } = await supabase.from("fi_surgery_cost_models").select("procedure_type").eq("tenant_id", tid);
  for (const row of costModels ?? []) {
    const p = String((row as { procedure_type?: string }).procedure_type ?? "").trim().toLowerCase();
    if (p) procedureTypes.add(p);
  }

  const surgeonLabels = new Map<string, string>();
  if (surgeonIds.size) {
    const { data: users } = await supabase
      .from("fi_users")
      .select("id, email")
      .eq("tenant_id", tid)
      .in("id", [...surgeonIds]);
    for (const u of users ?? []) {
      const r = u as { id: string; email?: string };
      surgeonLabels.set(String(r.id), r.email?.trim() || String(r.id));
    }
  }

  const clinicLabels = new Map<string, string>();
  const { data: clinics } = await supabase.from("fi_clinics").select("id, name").eq("tenant_id", tid);
  for (const c of clinics ?? []) {
    const r = c as { id: string; name?: string };
    clinicLabels.set(String(r.id), r.name?.trim() || String(r.id));
  }

  return {
    procedureTypes: [...procedureTypes].sort(),
    surgeonOptions: [...surgeonIds].map((id) => ({ value: id, label: surgeonLabels.get(id) ?? id })),
    clinicOptions: [...clinicIds].map((id) => ({ value: id, label: clinicLabels.get(id) ?? id })).concat(
      [...clinicLabels.entries()]
        .filter(([id]) => !clinicIds.has(id))
        .map(([value, label]) => ({ value, label }))
    ),
  };
}

export async function loadLiveSurgeryForCase(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<{
  surgery_id: string | null;
  target_grafts: number | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  treatment_addons: SurgeryEconomicsTreatmentAddons;
} | null> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgeries")
    .select("id, target_grafts, actual_start_at, actual_end_at, readiness_checklist")
    .eq("tenant_id", tenantId.trim())
    .eq("case_id", caseId.trim())
    .order("scheduled_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const checklist =
    row.readiness_checklist && typeof row.readiness_checklist === "object" && !Array.isArray(row.readiness_checklist)
      ? (row.readiness_checklist as Record<string, unknown>)
      : {};
  return {
    surgery_id: row.id != null ? String(row.id) : null,
    target_grafts: row.target_grafts != null ? Number(row.target_grafts) : null,
    actual_start_at: row.actual_start_at != null ? String(row.actual_start_at) : null,
    actual_end_at: row.actual_end_at != null ? String(row.actual_end_at) : null,
    treatment_addons: resolveTreatmentAddonsFromChecklist(checklist),
  };
}
