import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadProcedureDayForCase } from "@/src/lib/cases/procedureDayLoaders";
import { loadSurgeryPlanForCase } from "@/src/lib/cases/surgeryPlanningLoaders";
import {
  assessSurgeryProfitabilitySnapshotReadiness,
  mapProfitabilitySnapshotRow,
  type FiSurgeryProfitabilitySnapshotRow,
  type SurgeryCompletionContext,
  type SurgeryProfitabilitySnapshotReadiness,
} from "@/src/lib/financialOs/financialSurgeryEconomicsCore";
import {
  aggregateSurgeryInvoiceRevenue,
  calculateAndPersistSurgeryProfitabilitySnapshot,
  loadActiveSurgeryCostModel,
  loadLatestProfitabilitySnapshotForCase,
  loadLiveSurgeryForCase,
  resolveProcedureType,
  resolveTreatmentAddonsFromChecklist,
  surgeryInvoicesFromReadiness,
} from "@/src/lib/financialOs/financialSurgeryEconomics.server";
import { triggerRevenueAttributionOnSurgerySnapshot } from "@/src/lib/financialOs/financialRevenueAttribution.server";
import { loadCasePaymentReadiness } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";

export type SurgeryProfitabilitySnapshotTrigger = {
  source: string;
  actorFiUserId?: string | null;
  metadata?: Record<string, unknown>;
};

export type SurgeryProfitabilitySnapshotTriggerResult =
  | { ok: true; triggered: true; snapshot: FiSurgeryProfitabilitySnapshotRow }
  | { ok: true; triggered: false; readiness: SurgeryProfitabilitySnapshotReadiness }
  | { ok: false; error: string };

type SnapshotCaseContext = {
  tenantId: string;
  caseId: string;
  patientId: string | null;
  clinicId: string | null;
  procedureType: string | null;
  paymentReadiness: Awaited<ReturnType<typeof loadCasePaymentReadiness>>;
  surgeryPlan: Awaited<ReturnType<typeof loadSurgeryPlanForCase>>;
  procedureDay: Awaited<ReturnType<typeof loadProcedureDayForCase>>;
  liveSurgery: Awaited<ReturnType<typeof loadLiveSurgeryForCase>>;
  surgeryStatus: string | null;
  surgeryLiveStatus: string | null;
  bookingStatus: string | null;
  graftReconciliationCompleted: boolean;
  activeCostModel: Awaited<ReturnType<typeof loadActiveSurgeryCostModel>>;
};

async function loadGraftReconciliationCompleted(
  tenantId: string,
  surgeryId: string | null,
  client: SupabaseClient
): Promise<boolean> {
  if (!surgeryId) return false;
  const { data, error } = await client
    .from("fi_surgery_graft_sessions")
    .select("reconciliation_status")
    .eq("tenant_id", tenantId.trim())
    .eq("surgery_id", surgeryId.trim())
    .maybeSingle();
  if (error) return false;
  return String((data as { reconciliation_status?: string } | null)?.reconciliation_status ?? "") === "completed";
}

async function loadSurgeryBookingStatus(
  tenantId: string,
  surgeryId: string | null,
  client: SupabaseClient
): Promise<string | null> {
  if (!surgeryId) return null;
  const { data, error } = await client
    .from("fi_surgeries")
    .select("booking_id, status, live_status")
    .eq("tenant_id", tenantId.trim())
    .eq("id", surgeryId.trim())
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { booking_id?: string | null; status?: string; live_status?: string };
  const bookingId = row.booking_id?.trim() || null;
  if (!bookingId) {
    return null;
  }
  const { data: booking, error: be } = await client
    .from("fi_bookings")
    .select("booking_status")
    .eq("tenant_id", tenantId.trim())
    .eq("id", bookingId)
    .maybeSingle();
  if (be || !booking) return null;
  return String((booking as { booking_status?: string }).booking_status ?? "").trim() || null;
}

async function loadSnapshotCaseContext(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<SnapshotCaseContext> {
  const tid = tenantId.trim();
  const cid = caseId.trim();
  const supabase = client ?? supabaseAdmin();

  const [paymentReadiness, surgeryPlan, procedureDay, liveSurgery, caseRow] = await Promise.all([
    loadCasePaymentReadiness(tid, cid),
    loadSurgeryPlanForCase(tid, cid, supabase),
    loadProcedureDayForCase(tid, cid, supabase),
    loadLiveSurgeryForCase(tid, cid, supabase),
    supabase.from("fi_cases").select("patient_id, clinic_id").eq("tenant_id", tid).eq("id", cid).maybeSingle(),
  ]);

  const procedureType = resolveProcedureType({ surgeryPlan, procedureDay });
  const activeCostModel = procedureType ? await loadActiveSurgeryCostModel(tid, procedureType, supabase) : null;

  let surgeryStatus: string | null = null;
  let surgeryLiveStatus: string | null = null;
  const surgeryId = liveSurgery?.surgery_id ?? null;
  if (surgeryId) {
    const { data: surgeryRow } = await supabase
      .from("fi_surgeries")
      .select("status, live_status")
      .eq("tenant_id", tid)
      .eq("id", surgeryId)
      .maybeSingle();
    if (surgeryRow) {
      surgeryStatus = String((surgeryRow as { status?: string }).status ?? "").trim() || null;
      surgeryLiveStatus = String((surgeryRow as { live_status?: string }).live_status ?? "").trim() || null;
    }
  }

  const bookingStatus = await loadSurgeryBookingStatus(tid, surgeryId, supabase);
  const graftReconciliationCompleted = await loadGraftReconciliationCompleted(tid, surgeryId, supabase);

  const c = caseRow.data as { patient_id?: string | null; clinic_id?: string | null } | null;

  return {
    tenantId: tid,
    caseId: cid,
    patientId: c?.patient_id != null ? String(c.patient_id) : null,
    clinicId: c?.clinic_id != null ? String(c.clinic_id) : null,
    procedureType,
    paymentReadiness,
    surgeryPlan,
    procedureDay,
    liveSurgery,
    surgeryStatus,
    surgeryLiveStatus,
    bookingStatus,
    graftReconciliationCompleted,
    activeCostModel,
  };
}

export function buildSnapshotReadinessFromContext(ctx: SnapshotCaseContext): SurgeryProfitabilitySnapshotReadiness {
  const surgeryInvoices = surgeryInvoicesFromReadiness(ctx.paymentReadiness);
  const revenueAgg = aggregateSurgeryInvoiceRevenue(surgeryInvoices);
  const completion: SurgeryCompletionContext = {
    procedure_status: ctx.procedureDay?.procedure_status ?? null,
    surgery_status: ctx.surgeryStatus,
    surgery_live_status: ctx.surgeryLiveStatus,
    booking_status: ctx.bookingStatus,
    graft_reconciliation_completed: ctx.graftReconciliationCompleted,
  };
  return assessSurgeryProfitabilitySnapshotReadiness({
    tenant_id: ctx.tenantId,
    procedure_type: ctx.procedureType,
    has_active_cost_model: Boolean(ctx.activeCostModel),
    surgery_invoice_count: surgeryInvoices.length,
    revenue_cents: revenueAgg.revenue_cents,
    completion,
  });
}

export async function evaluateSurgeryProfitabilitySnapshotReadiness(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<SurgeryProfitabilitySnapshotReadiness> {
  const ctx = await loadSnapshotCaseContext(tenantId, caseId, client);
  return buildSnapshotReadinessFromContext(ctx);
}

export async function loadProfitabilitySnapshotHistoryForCase(
  tenantId: string,
  caseId: string,
  limit = 50,
  client?: SupabaseClient
): Promise<FiSurgeryProfitabilitySnapshotRow[]> {
  const tid = tenantId.trim();
  const cid = caseId.trim();
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_profitability_snapshots")
    .select("*")
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .order("calculated_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapProfitabilitySnapshotRow(r as Record<string, unknown>));
}

/**
 * Best-effort auto-trigger — never throws; used from surgery/finance mutation hooks.
 */
export async function maybeTriggerSurgeryProfitabilitySnapshot(args: {
  tenantId: string;
  caseId: string;
  trigger: SurgeryProfitabilitySnapshotTrigger;
  client?: SupabaseClient;
}): Promise<SurgeryProfitabilitySnapshotTriggerResult> {
  try {
    return await triggerSurgeryProfitabilitySnapshotForCase({
      tenantId: args.tenantId,
      caseId: args.caseId,
      trigger: args.trigger,
      client: args.client,
      allowNotReady: true,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Snapshot trigger failed." };
  }
}

export async function triggerSurgeryProfitabilitySnapshotForCase(args: {
  tenantId: string;
  caseId: string;
  trigger: SurgeryProfitabilitySnapshotTrigger;
  client?: SupabaseClient;
  /** When true (auto hooks), skip if not ready. Manual actions pass false. */
  allowNotReady?: boolean;
}): Promise<SurgeryProfitabilitySnapshotTriggerResult> {
  const ctx = await loadSnapshotCaseContext(args.tenantId, args.caseId, args.client);
  const readiness = buildSnapshotReadinessFromContext(ctx);

  if (!readiness.ready) {
    if (args.allowNotReady) {
      return { ok: true, triggered: false, readiness };
    }
    return {
      ok: true,
      triggered: false,
      readiness,
    };
  }

  if (!ctx.procedureType || !ctx.activeCostModel) {
    return {
      ok: true,
      triggered: false,
      readiness,
    };
  }

  const surgeryInvoices = surgeryInvoicesFromReadiness(ctx.paymentReadiness);
  const revenueAgg = aggregateSurgeryInvoiceRevenue(surgeryInvoices);
  const checklist =
    ctx.liveSurgery?.treatment_addons
      ? { prp_prepared: ctx.liveSurgery.treatment_addons.prp, exosomes_prepared: ctx.liveSurgery.treatment_addons.exosome }
      : {};

  const snapshot = await calculateAndPersistSurgeryProfitabilitySnapshot({
    tenantId: ctx.tenantId,
    caseId: ctx.caseId,
    surgeryId: ctx.liveSurgery?.surgery_id ?? null,
    patientId: ctx.patientId,
    procedureType: ctx.procedureType,
    costModel: ctx.activeCostModel,
    procedureDay: ctx.procedureDay,
    surgeryPlan: ctx.surgeryPlan,
    paymentReadiness: ctx.paymentReadiness,
    treatmentAddons: resolveTreatmentAddonsFromChecklist(checklist),
    liveGraftCount: ctx.liveSurgery?.target_grafts ?? null,
    actualStartAt: ctx.liveSurgery?.actual_start_at ?? null,
    actualEndAt: ctx.liveSurgery?.actual_end_at ?? null,
    actorFiUserId: args.trigger.actorFiUserId,
    sourceMetadata: {
      trigger_source: args.trigger.source,
      surgeon_user_id: ctx.procedureDay?.surgeon_user_id ?? null,
      clinic_id: ctx.clinicId,
      invoice_revenue_cents: revenueAgg.revenue_cents,
      ...(args.trigger.metadata ?? {}),
    },
    client: args.client,
  });

  try {
    await triggerRevenueAttributionOnSurgerySnapshot({
      tenantId: ctx.tenantId,
      caseId: ctx.caseId,
      surgeryId: ctx.liveSurgery?.surgery_id ?? null,
      patientId: ctx.patientId,
      invoiceId: snapshot.invoice_id,
      snapshotId: snapshot.id ?? String((snapshot as { id?: string }).id ?? args.caseId),
      revenueCents: snapshot.revenue_cents,
      collectedCents: snapshot.collected_cents,
      grossProfitCents: snapshot.gross_profit_cents,
      procedureType: snapshot.procedure_type,
    });
  } catch {
    /* attribution best-effort */
  }

  return { ok: true, triggered: true, snapshot };
}

export async function loadCaseSnapshotReadinessSummary(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<{
  readiness: SurgeryProfitabilitySnapshotReadiness;
  snapshot_count: number;
  latest_snapshot: FiSurgeryProfitabilitySnapshotRow | null;
}> {
  const tid = tenantId.trim();
  const cid = caseId.trim();
  const supabase = client ?? supabaseAdmin();
  const readiness = await evaluateSurgeryProfitabilitySnapshotReadiness(tid, cid, supabase);
  const latestSnapshot = await loadLatestProfitabilitySnapshotForCase(tid, cid, supabase);
  const history = await loadProfitabilitySnapshotHistoryForCase(tid, cid, 100, supabase);
  return {
    readiness,
    snapshot_count: history.length,
    latest_snapshot: latestSnapshot,
  };
}
