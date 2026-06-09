import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrescriptionEditorClient } from "@/src/components/fi-admin/prescribing/PrescriptionEditorClient";
import type { PrescriptionEditorLine } from "@/src/components/fi-admin/prescribing/PrescriptionEditorClient";
import { formatClinicalPickerOptionLabel } from "@/src/lib/staff/clinicalStaffPicker";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import {
  loadActiveCompoundPharmaciesForTenant,
  loadPharmacyTransmissionsForPrescription,
} from "@/src/lib/prescribing/fiPharmacyLoaders.server";
import { loadMedicationCatalogueForTenant, loadPrescriptionDetail } from "@/src/lib/prescribing/fiPrescribingLoaders.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; prescriptionId: string }>;
}): Promise<Metadata> {
  const { prescriptionId } = await params;
  return {
    title: `Prescription ${prescriptionId.slice(0, 8)}…`,
    robots: { index: false, follow: false },
  };
}

export default async function PrescriptionEditorRoutePage({
  params,
}: {
  params: Promise<{ tenantId: string; prescriptionId: string }>;
}) {
  const { tenantId, prescriptionId } = await params;
  if (!tenantId?.trim() || !prescriptionId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const tid = tenantId.trim();
  const rid = prescriptionId.trim();

  const [bundle, catalogue, staff, pharmacies, transmissions] = await Promise.all([
    loadPrescriptionDetail(tid, rid),
    loadMedicationCatalogueForTenant(tid),
    loadClinicalStaffPickerOptions(tid),
    loadActiveCompoundPharmaciesForTenant(tid),
    loadPharmacyTransmissionsForPrescription(tid, rid),
  ]);

  if (!bundle) notFound();

  if (staff.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-sm text-slate-700">
        <p>Add at least one active staff member (Settings → Staff) before editing prescriptions.</p>
      </div>
    );
  }

  const p = bundle.prescription;

  const staffOptions = staff.map((s) => ({
    id: s.id,
    label: formatClinicalPickerOptionLabel(s),
    clinicallyAvailable: s.clinical_readiness.clinically_available,
    blockReason: s.clinical_readiness.block_reason,
  }));

  if (!staff.some((s) => s.id === p.doctor_id)) {
    staffOptions.unshift({
      id: p.doctor_id,
      label: "Recorded prescriber (not in active staff list)",
      clinicallyAvailable: true,
      blockReason: null,
    });
  }

  const initialItems: PrescriptionEditorLine[] = bundle.items.map((it) => ({
    key: it.id,
    catalogueId: it.catalogue_id ?? "",
    doseInstructions: it.dose_instructions,
    repeatsInstructions: it.repeats_instructions ?? "",
    reorderRule: it.reorder_rule ?? "",
    repeatRulesPrescriberConfirmed: it.repeat_rules_prescriber_confirmed,
  }));

  return (
    <PrescriptionEditorClient
      tenantId={tid}
      patientId={p.patient_id}
      caseId={p.case_id}
      initialPrescriptionId={p.id}
      initialStatus={p.status}
      initialDoctorId={p.doctor_id}
      initialClinicalNotes={p.clinical_notes ?? ""}
      initialDeliveryType={p.delivery_type ?? ""}
      initialPatientShippingAddress={p.patient_shipping_address ?? ""}
      initialPharmacyName={p.pharmacy_name ?? ""}
      initialReadyForPharmacyAt={p.ready_for_pharmacy_at}
      initialSignedAt={p.signed_at}
      initialItems={initialItems}
      catalogue={catalogue}
      staffOptions={staffOptions}
      initialEvents={bundle.events}
      initialPharmacies={pharmacies}
      initialTransmissions={transmissions}
      initialRepeatsAllowed={p.repeats_allowed}
      initialRepeatLimit={p.repeat_limit}
      initialReorderValidFrom={p.reorder_valid_from ?? ""}
      initialReorderValidUntil={p.reorder_valid_until ?? ""}
      initialReorderReviewRequired={p.reorder_review_required}
      initialPatientReorderFeePence={p.patient_reorder_fee_pence != null ? String(p.patient_reorder_fee_pence) : ""}
      initialReorderFeePaymentRequired={p.reorder_fee_payment_required}
    />
  );
}
