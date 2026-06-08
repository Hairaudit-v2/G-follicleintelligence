import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  FiMedicationCatalogueRow,
  FiPatientPrescriptionRow,
  FiPrescriptionItemRow,
  FiPrescriptionStatusEventRow,
  MedicationCatalogueCategory,
  MedicationFormType,
  PrescriptionStatus,
} from "./fiPrescribingTypes";

function asCatalogueRow(raw: Record<string, unknown>): FiMedicationCatalogueRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    category: raw.category as MedicationCatalogueCategory,
    medication_name: String(raw.medication_name ?? ""),
    form_type: raw.form_type as MedicationFormType,
    quantity_label: String(raw.quantity_label ?? ""),
    base_price: Number(raw.base_price ?? 0),
    active: Boolean(raw.active),
    pharmacy_notes: raw.pharmacy_notes != null ? String(raw.pharmacy_notes) : null,
    requires_doctor_approval: Boolean(raw.requires_doctor_approval),
  };
}

function asPrescriptionRow(raw: Record<string, unknown>): FiPatientPrescriptionRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: String(raw.patient_id),
    doctor_id: String(raw.doctor_id),
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    status: raw.status as PrescriptionStatus,
    pharmacy_id: raw.pharmacy_id != null ? String(raw.pharmacy_id) : null,
    pharmacy_name: raw.pharmacy_name != null ? String(raw.pharmacy_name) : null,
    delivery_type: raw.delivery_type != null ? String(raw.delivery_type) : null,
    patient_shipping_address: raw.patient_shipping_address != null ? String(raw.patient_shipping_address) : null,
    clinical_notes: raw.clinical_notes != null ? String(raw.clinical_notes) : null,
    signed_at: raw.signed_at != null ? String(raw.signed_at) : null,
    sent_at: raw.sent_at != null ? String(raw.sent_at) : null,
    ready_for_pharmacy_at: raw.ready_for_pharmacy_at != null ? String(raw.ready_for_pharmacy_at) : null,
    created_by_fi_user_id: raw.created_by_fi_user_id != null ? String(raw.created_by_fi_user_id) : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

function asItemRow(raw: Record<string, unknown>): FiPrescriptionItemRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    prescription_id: String(raw.prescription_id),
    catalogue_id: raw.catalogue_id != null ? String(raw.catalogue_id) : null,
    medication_name: String(raw.medication_name ?? ""),
    form_type: raw.form_type as MedicationFormType,
    quantity_label: String(raw.quantity_label ?? ""),
    dose_instructions: String(raw.dose_instructions ?? ""),
    repeats_instructions: raw.repeats_instructions != null ? String(raw.repeats_instructions) : null,
    reorder_rule: raw.reorder_rule != null ? String(raw.reorder_rule) : null,
    sort_order: Number(raw.sort_order ?? 0),
    created_at: String(raw.created_at ?? ""),
  };
}

function asEventRow(raw: Record<string, unknown>): FiPrescriptionStatusEventRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    prescription_id: String(raw.prescription_id),
    from_status: raw.from_status != null ? String(raw.from_status) : null,
    to_status: String(raw.to_status ?? ""),
    actor_fi_user_id: raw.actor_fi_user_id != null ? String(raw.actor_fi_user_id) : null,
    note: raw.note != null ? String(raw.note) : null,
    created_at: String(raw.created_at ?? ""),
  };
}

export async function loadMedicationCatalogueForTenant(tenantId: string): Promise<FiMedicationCatalogueRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_medication_catalogue")
    .select(
      "id, tenant_id, category, medication_name, form_type, quantity_label, base_price, active, pharmacy_notes, requires_doctor_approval"
    )
    .eq("tenant_id", tenantId.trim())
    .eq("active", true)
    .order("category", { ascending: true })
    .order("medication_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asCatalogueRow(r as Record<string, unknown>));
}

export async function loadPrescriptionsForPatient(
  tenantId: string,
  patientId: string
): Promise<FiPatientPrescriptionRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_prescriptions")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asPrescriptionRow(r as Record<string, unknown>));
}

export async function loadPrescriptionsForCase(
  tenantId: string,
  caseId: string
): Promise<FiPatientPrescriptionRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_prescriptions")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("case_id", caseId.trim())
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asPrescriptionRow(r as Record<string, unknown>));
}

export async function loadRecentPrescriptionsForTenant(
  tenantId: string,
  opts?: { limit?: number }
): Promise<FiPatientPrescriptionRow[]> {
  const supabase = supabaseAdmin();
  const lim = Math.min(Math.max(opts?.limit ?? 80, 1), 200);
  const { data, error } = await supabase
    .from("fi_patient_prescriptions")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .order("updated_at", { ascending: false })
    .limit(lim);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asPrescriptionRow(r as Record<string, unknown>));
}

export type FiPrescriptionDetailBundle = {
  prescription: FiPatientPrescriptionRow;
  items: FiPrescriptionItemRow[];
  events: FiPrescriptionStatusEventRow[];
};

export async function loadPrescriptionDetail(
  tenantId: string,
  prescriptionId: string
): Promise<FiPrescriptionDetailBundle | null> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const pid = prescriptionId.trim();
  const { data: rx, error: e1 } = await supabase
    .from("fi_patient_prescriptions")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!rx) return null;

  const [{ data: items, error: e2 }, { data: events, error: e3 }] = await Promise.all([
    supabase
      .from("fi_prescription_items")
      .select("*")
      .eq("tenant_id", tid)
      .eq("prescription_id", pid)
      .order("sort_order", { ascending: true }),
    supabase
      .from("fi_prescription_status_events")
      .select("*")
      .eq("tenant_id", tid)
      .eq("prescription_id", pid)
      .order("created_at", { ascending: true }),
  ]);
  if (e2) throw new Error(e2.message);
  if (e3) throw new Error(e3.message);

  return {
    prescription: asPrescriptionRow(rx as Record<string, unknown>),
    items: (items ?? []).map((r) => asItemRow(r as Record<string, unknown>)),
    events: (events ?? []).map((r) => asEventRow(r as Record<string, unknown>)),
  };
}

export async function resolveDefaultDoctorStaffIdForFiUser(
  tenantId: string,
  fiUserId: string
): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("fi_user_id", fiUserId.trim())
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return String((data as { id: string }).id);
}
