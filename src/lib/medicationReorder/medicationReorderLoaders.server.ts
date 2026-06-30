import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  MEDICATION_REORDER_PAYMENT_STATUSES,
  MEDICATION_REORDER_STATUSES,
  type FiMedicationReorderRequestRow,
  type MedicationReorderPaymentStatus,
  type MedicationReorderStatus,
} from "@/src/lib/medicationReorder/medicationReorderTypes";
import { loadPrescriptionsForPatient } from "@/src/lib/prescribing/fiPrescribingLoaders.server";
import type {
  FiPatientPrescriptionRow,
  FiPrescriptionItemRow,
} from "@/src/lib/prescribing/fiPrescribingTypes";

function asReorderRow(raw: Record<string, unknown>): FiMedicationReorderRequestRow {
  const st = String(raw.status ?? "");
  const status = (MEDICATION_REORDER_STATUSES as readonly string[]).includes(st)
    ? (st as MedicationReorderStatus)
    : "requested";
  const pay = String(raw.payment_status ?? "not_required");
  const payment_status = (MEDICATION_REORDER_PAYMENT_STATUSES as readonly string[]).includes(pay)
    ? (pay as MedicationReorderPaymentStatus)
    : "not_required";
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: String(raw.patient_id),
    source_prescription_id: String(raw.source_prescription_id),
    source_prescription_item_id: String(raw.source_prescription_item_id),
    delivery_address: String(raw.delivery_address ?? ""),
    status,
    fee_pence: raw.fee_pence != null && raw.fee_pence !== "" ? Number(raw.fee_pence) : null,
    payment_status,
    doctor_review_crm_task_id:
      raw.doctor_review_crm_task_id != null ? String(raw.doctor_review_crm_task_id) : null,
    rejection_reason: raw.rejection_reason != null ? String(raw.rejection_reason) : null,
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export async function loadMedicationReorderPendingReviewCount(tenantId: string): Promise<number> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const { count, error } = await supabase
    .from("fi_medication_reorder_requests")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .in("status", ["requested", "doctor_review_required"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadMedicationReorderRequestsForPatient(
  tenantId: string,
  patientId: string
): Promise<FiMedicationReorderRequestRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_medication_reorder_requests")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asReorderRow(r as Record<string, unknown>));
}

export async function loadMedicationReorderRequestsForTenant(
  tenantId: string,
  opts?: { statusIn?: MedicationReorderStatus[] }
): Promise<FiMedicationReorderRequestRow[]> {
  const supabase = supabaseAdmin();
  let q = supabase
    .from("fi_medication_reorder_requests")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(200);
  if (opts?.statusIn?.length) {
    q = q.in("status", opts.statusIn);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asReorderRow(r as Record<string, unknown>));
}

export type MedicationPortalLine = {
  item: FiPrescriptionItemRow;
  prescription: FiPatientPrescriptionRow;
};

export async function loadMedicationPortalLines(
  tenantId: string,
  patientId: string
): Promise<MedicationPortalLine[]> {
  const rxs = await loadPrescriptionsForPatient(tenantId, patientId);
  if (!rxs.length) return [];
  const ids = rxs.map((r) => r.id);
  const supabase = supabaseAdmin();
  const { data: items, error } = await supabase
    .from("fi_prescription_items")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .in("prescription_id", ids)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  const byRx = new Map<string, FiPatientPrescriptionRow>();
  for (const r of rxs) byRx.set(r.id, r);
  const out: MedicationPortalLine[] = [];
  for (const raw of items ?? []) {
    const row = raw as Record<string, unknown>;
    const rid = String(row.prescription_id ?? "");
    const rx = byRx.get(rid);
    if (!rx) continue;
    out.push({
      prescription: rx,
      item: {
        id: String(row.id),
        tenant_id: String(row.tenant_id),
        prescription_id: rid,
        catalogue_id: row.catalogue_id != null ? String(row.catalogue_id) : null,
        medication_name: String(row.medication_name ?? ""),
        form_type: row.form_type as FiPrescriptionItemRow["form_type"],
        quantity_label: String(row.quantity_label ?? ""),
        dose_instructions: String(row.dose_instructions ?? ""),
        repeats_instructions:
          row.repeats_instructions != null ? String(row.repeats_instructions) : null,
        reorder_rule: row.reorder_rule != null ? String(row.reorder_rule) : null,
        repeat_rules_prescriber_confirmed: Boolean(row.repeat_rules_prescriber_confirmed),
        sort_order: Number(row.sort_order ?? 0),
        created_at: String(row.created_at ?? ""),
      },
    });
  }
  return out;
}

export async function loadMedicationReorderQueueForTenant(
  tenantId: string
): Promise<(FiMedicationReorderRequestRow & { medication_name: string })[]> {
  const rows = await loadMedicationReorderRequestsForTenant(tenantId);
  if (!rows.length) return [];
  const supabase = supabaseAdmin();
  const ids = Array.from(new Set(rows.map((r) => r.source_prescription_item_id)));
  const { data: items, error } = await supabase
    .from("fi_prescription_items")
    .select("id, medication_name")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const it of items ?? []) {
    map.set(
      String((it as { id: string }).id),
      String((it as { medication_name: string }).medication_name ?? "")
    );
  }
  return rows.map((r) => ({
    ...r,
    medication_name: map.get(r.source_prescription_item_id) ?? "Medication",
  }));
}
