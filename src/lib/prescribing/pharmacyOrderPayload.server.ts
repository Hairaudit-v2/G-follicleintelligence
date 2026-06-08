import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { casePersonDisplayFromMetadata } from "@/src/lib/cases/caseLabels";
import { loadPrescriptionDetail } from "@/src/lib/prescribing/fiPrescribingLoaders.server";
import type { FiCompoundPharmacyRow, PharmacyOrderPayloadSnapshotV1 } from "@/src/lib/prescribing/fiPharmacyLoaders.server";

export type PharmacyOrderPdfContext = {
  clinicName: string;
  clinicLines: string[];
  accentHex: string | null;
  prescriptionId: string;
  patientName: string;
  patientEmail: string | null;
  shippingAddress: string;
  deliveryType: string | null;
  clinicalNotes: string | null;
  prescriberName: string;
  prescriberRole: string;
  pharmacyName: string;
  pharmacyEmail: string;
  pharmacyPhone: string | null;
  pharmacyAddress: string | null;
  items: Array<{
    medication_name: string;
    form_type: string;
    quantity_label: string;
    dose_instructions: string;
    repeats_instructions: string | null;
    reorder_rule: string | null;
    repeat_confirmed: boolean;
  }>;
  signedAt: string | null;
};

async function loadPatientPersonDisplay(tenantId: string, patientId: string): Promise<{ label: string; email: string | null }> {
  const supabase = supabaseAdmin();
  const { data: pat, error: pe } = await supabase
    .from("fi_patients")
    .select("person_id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", patientId.trim())
    .maybeSingle();
  if (pe || !pat) return { label: "Patient", email: null };
  const personId = String((pat as { person_id: string }).person_id);
  const { data: person, error: e2 } = await supabase
    .from("fi_persons")
    .select("metadata")
    .eq("tenant_id", tenantId.trim())
    .eq("id", personId)
    .maybeSingle();
  if (e2 || !person) return { label: "Patient", email: null };
  const meta =
    (person as { metadata: unknown }).metadata &&
    typeof (person as { metadata: unknown }).metadata === "object" &&
    !Array.isArray((person as { metadata: unknown }).metadata)
      ? ((person as { metadata: unknown }).metadata as Record<string, unknown>)
      : {};
  const d = casePersonDisplayFromMetadata(meta);
  return { label: d.label, email: d.email };
}

async function loadPrescriberLabel(tenantId: string, staffId: string): Promise<{ full_name: string; staff_role: string }> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("full_name, staff_role")
    .eq("tenant_id", tenantId.trim())
    .eq("id", staffId.trim())
    .maybeSingle();
  if (error || !data) return { full_name: "Prescriber", staff_role: "—" };
  const r = data as { full_name: string | null; staff_role: string | null };
  return {
    full_name: String(r.full_name ?? "").trim() || "Prescriber",
    staff_role: String(r.staff_role ?? "").trim() || "—",
  };
}

export async function buildPharmacyOrderPayloadSnapshotV1(params: {
  tenantId: string;
  prescriptionId: string;
  pharmacy: FiCompoundPharmacyRow;
}): Promise<PharmacyOrderPayloadSnapshotV1> {
  const tid = params.tenantId.trim();
  const rid = params.prescriptionId.trim();
  const bundle = await loadPrescriptionDetail(tid, rid);
  if (!bundle) throw new Error("Prescription not found.");

  const patient = await loadPatientPersonDisplay(tid, bundle.prescription.patient_id);
  const prescriber = await loadPrescriberLabel(tid, bundle.prescription.doctor_id);

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    prescription: {
      id: bundle.prescription.id,
      patient_id: bundle.prescription.patient_id,
      doctor_id: bundle.prescription.doctor_id,
      case_id: bundle.prescription.case_id,
      delivery_type: bundle.prescription.delivery_type,
      patient_shipping_address: bundle.prescription.patient_shipping_address,
      clinical_notes: bundle.prescription.clinical_notes,
      signed_at: bundle.prescription.signed_at,
    },
    items: bundle.items,
    patient: { display_name: patient.label, email: patient.email },
    prescriber: { full_name: prescriber.full_name, staff_role: prescriber.staff_role },
    pharmacy: {
      id: params.pharmacy.id,
      pharmacy_name: params.pharmacy.pharmacy_name,
      contact_email: params.pharmacy.contact_email,
      phone: params.pharmacy.phone,
      address: params.pharmacy.address,
    },
  };
}

export async function buildPharmacyOrderPdfContext(params: {
  tenantId: string;
  prescriptionId: string;
  pharmacy: FiCompoundPharmacyRow;
  branding: { brand_name: string | null; clinic_display_name: string | null; accent_colour: string | null };
}): Promise<PharmacyOrderPdfContext> {
  const tid = params.tenantId.trim();
  const rid = params.prescriptionId.trim();
  const bundle = await loadPrescriptionDetail(tid, rid);
  if (!bundle) throw new Error("Prescription not found.");

  const patient = await loadPatientPersonDisplay(tid, bundle.prescription.patient_id);
  const prescriber = await loadPrescriberLabel(tid, bundle.prescription.doctor_id);

  const clinicName =
    params.branding.clinic_display_name?.trim() ||
    params.branding.brand_name?.trim() ||
    "Follicle Intelligence clinic";

  return {
    clinicName,
    clinicLines: [params.pharmacy.pharmacy_name, "Compound pharmacy order"],
    accentHex: params.branding.accent_colour,
    prescriptionId: rid,
    patientName: patient.label,
    patientEmail: patient.email,
    shippingAddress: bundle.prescription.patient_shipping_address?.trim() || "—",
    deliveryType: bundle.prescription.delivery_type,
    clinicalNotes: bundle.prescription.clinical_notes,
    prescriberName: prescriber.full_name,
    prescriberRole: prescriber.staff_role,
    pharmacyName: params.pharmacy.pharmacy_name,
    pharmacyEmail: params.pharmacy.contact_email,
    pharmacyPhone: params.pharmacy.phone,
    pharmacyAddress: params.pharmacy.address,
    items: bundle.items.map((it) => ({
      medication_name: it.medication_name,
      form_type: it.form_type,
      quantity_label: it.quantity_label,
      dose_instructions: it.dose_instructions,
      repeats_instructions: it.repeats_instructions,
      reorder_rule: it.reorder_rule,
      repeat_confirmed: it.repeat_rules_prescriber_confirmed,
    })),
    signedAt: bundle.prescription.signed_at,
  };
}

export function pharmacyOrderPdfContextFromSnapshot(
  snap: PharmacyOrderPayloadSnapshotV1,
  branding: { brand_name: string | null; clinic_display_name: string | null; accent_colour: string | null }
): PharmacyOrderPdfContext {
  const clinicName =
    branding.clinic_display_name?.trim() || branding.brand_name?.trim() || "Follicle Intelligence clinic";
  return {
    clinicName,
    clinicLines: [snap.pharmacy.pharmacy_name, "Compound pharmacy order"],
    accentHex: branding.accent_colour,
    prescriptionId: snap.prescription.id,
    patientName: snap.patient.display_name,
    patientEmail: snap.patient.email,
    shippingAddress: snap.prescription.patient_shipping_address?.trim() || "—",
    deliveryType: snap.prescription.delivery_type,
    clinicalNotes: snap.prescription.clinical_notes,
    prescriberName: snap.prescriber.full_name,
    prescriberRole: snap.prescriber.staff_role,
    pharmacyName: snap.pharmacy.pharmacy_name,
    pharmacyEmail: snap.pharmacy.contact_email,
    pharmacyPhone: snap.pharmacy.phone,
    pharmacyAddress: snap.pharmacy.address,
    items: snap.items.map((it) => ({
      medication_name: it.medication_name,
      form_type: it.form_type,
      quantity_label: it.quantity_label,
      dose_instructions: it.dose_instructions,
      repeats_instructions: it.repeats_instructions,
      reorder_rule: it.reorder_rule,
      repeat_confirmed: it.repeat_rules_prescriber_confirmed,
    })),
    signedAt: snap.prescription.signed_at,
  };
}
