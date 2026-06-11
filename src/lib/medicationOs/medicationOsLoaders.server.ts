import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildActiveTherapyPlanSummary,
  toMedicationOsCanonicalRow,
  toPatientTherapyEventRow,
  toPatientTherapyPlanItemRow,
  toPatientTherapyPlanRow,
} from "./medicationOsMappers";
import type {
  ActiveTherapyPlanSummary,
  LoadTherapyEventsOptions,
  LoadTherapyPlansOptions,
  MedicationOsCanonicalRow,
  MedicationOsTherapyPlanBundle,
  PatientTherapyEventRow,
  PatientTherapyPlanItemRow,
} from "./medicationOsTypes";
import {
  MEDICATION_OS_CANONICAL_SELECT,
  PATIENT_THERAPY_EVENT_SELECT,
  PATIENT_THERAPY_PLAN_ITEM_SELECT,
  PATIENT_THERAPY_PLAN_SELECT,
} from "./medicationOsTypes";

const DEFAULT_PLAN_LIMIT = 100;
const DEFAULT_EVENT_LIMIT = 50;
const ACTIVE_SUMMARY_PLAN_LIMIT = 40;

function clampInt(n: number | undefined, fallback: number, min: number, max: number): number {
  if (n == null || Number.isNaN(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

async function loadPlanItemsByPlanIds(
  supabase: SupabaseClient,
  tenantId: string,
  planIds: string[]
): Promise<Map<string, PatientTherapyPlanItemRow[]>> {
  const tid = tenantId.trim();
  const ids = planIds.map((id) => id.trim()).filter(Boolean);
  const map = new Map<string, PatientTherapyPlanItemRow[]>();
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from("fi_patient_therapy_plan_items")
    .select(PATIENT_THERAPY_PLAN_ITEM_SELECT)
    .eq("tenant_id", tid)
    .in("plan_id", ids)
    .order("plan_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const row = toPatientTherapyPlanItemRow(raw as Record<string, unknown>);
    const arr = map.get(row.plan_id) ?? [];
    arr.push(row);
    map.set(row.plan_id, arr);
  }
  return map;
}

/**
 * Tenant-scoped MedicationOS canonical vocabulary (active rows only).
 */
export async function loadMedicationOsCanonicalForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<MedicationOsCanonicalRow[]> {
  const tid = tenantId.trim();
  const { data, error } = await supabase
    .from("fi_medication_os_canonical")
    .select(MEDICATION_OS_CANONICAL_SELECT)
    .eq("tenant_id", tid)
    .eq("active", true)
    .order("canonical_code", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toMedicationOsCanonicalRow(r as Record<string, unknown>));
}

/**
 * Therapy plans for a foundation patient, optionally with line items.
 */
export async function loadPatientTherapyPlansForPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  options?: LoadTherapyPlansOptions
): Promise<MedicationOsTherapyPlanBundle[]> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const limit = clampInt(options?.limit, DEFAULT_PLAN_LIMIT, 1, 200);
  const includeItems = options?.includeItems !== false;

  let q = supabase
    .from("fi_patient_therapy_plans")
    .select(PATIENT_THERAPY_PLAN_SELECT)
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (options?.statusIn?.length) {
    q = q.in("status", options.statusIn);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const plans = (data ?? []).map((r) => toPatientTherapyPlanRow(r as Record<string, unknown>));
  if (!includeItems) {
    return plans.map((plan) => ({ plan, items: [] }));
  }
  const itemsByPlan = await loadPlanItemsByPlanIds(
    supabase,
    tid,
    plans.map((p) => p.id)
  );
  return plans.map((plan) => ({ plan, items: itemsByPlan.get(plan.id) ?? [] }));
}

/**
 * Therapy plans linked to a case (via `case_id` on the plan header).
 */
export async function loadPatientTherapyPlansForCase(
  supabase: SupabaseClient,
  tenantId: string,
  caseId: string,
  options?: LoadTherapyPlansOptions
): Promise<MedicationOsTherapyPlanBundle[]> {
  const tid = tenantId.trim();
  const cid = caseId.trim();
  const limit = clampInt(options?.limit, DEFAULT_PLAN_LIMIT, 1, 200);
  const includeItems = options?.includeItems !== false;

  let q = supabase
    .from("fi_patient_therapy_plans")
    .select(PATIENT_THERAPY_PLAN_SELECT)
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (options?.statusIn?.length) {
    q = q.in("status", options.statusIn);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const plans = (data ?? []).map((r) => toPatientTherapyPlanRow(r as Record<string, unknown>));
  if (!includeItems) {
    return plans.map((plan) => ({ plan, items: [] }));
  }
  const itemsByPlan = await loadPlanItemsByPlanIds(
    supabase,
    tid,
    plans.map((p) => p.id)
  );
  return plans.map((plan) => ({ plan, items: itemsByPlan.get(plan.id) ?? [] }));
}

/**
 * Append-only therapy events for a patient (newest first).
 */
export async function loadPatientTherapyEventsForPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  options?: LoadTherapyEventsOptions
): Promise<PatientTherapyEventRow[]> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const limit = clampInt(options?.limit, DEFAULT_EVENT_LIMIT, 1, 500);

  let q = supabase
    .from("fi_patient_therapy_events")
    .select(PATIENT_THERAPY_EVENT_SELECT)
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (options?.eventTypeIn?.length) {
    q = q.in("event_type", options.eventTypeIn);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toPatientTherapyEventRow(r as Record<string, unknown>));
}

/**
 * Active plans + items summary for dashboards / Twin (bounded plan count).
 */
export async function loadActiveTherapyPlanSummary(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<ActiveTherapyPlanSummary> {
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const [canonicalRows, planBundles] = await Promise.all([
    loadMedicationOsCanonicalForTenant(supabase, tid),
    loadPatientTherapyPlansForPatient(supabase, tid, pid, {
      statusIn: ["active"],
      limit: ACTIVE_SUMMARY_PLAN_LIMIT,
      includeItems: true,
    }),
  ]);

  const displayNameByCanonicalCode = new Map<string, string>();
  for (const c of canonicalRows) {
    displayNameByCanonicalCode.set(c.canonical_code, c.display_name);
  }

  const activePlans = planBundles.map((b) => b.plan);
  const itemsByPlanId = new Map<string, PatientTherapyPlanItemRow[]>();
  for (const b of planBundles) {
    itemsByPlanId.set(b.plan.id, b.items);
  }

  return buildActiveTherapyPlanSummary({
    activePlans,
    itemsByPlanId,
    displayNameByCanonicalCode,
  });
}
