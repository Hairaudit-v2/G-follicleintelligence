import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrescriptionEditorClient } from "@/src/components/fi-admin/prescribing/PrescriptionEditorClient";
import { getFiTenantMemberSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadCrmShellStaffPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import {
  loadMedicationCatalogueForTenant,
  resolveDefaultDoctorStaffIdForFiUser,
} from "@/src/lib/prescribing/fiPrescribingLoaders.server";

export const dynamic = "force-dynamic";

export default async function NewPrescriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  const sp = (await searchParams) ?? {};
  const patientIdRaw = sp.patientId;
  const patientId = Array.isArray(patientIdRaw) ? patientIdRaw[0] : patientIdRaw;
  if (!tenantId?.trim() || !patientId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const caseIdRaw = sp.caseId;
  const caseId = (Array.isArray(caseIdRaw) ? caseIdRaw[0] : caseIdRaw)?.trim() || null;

  const session = await getFiTenantMemberSessionIfAllowed(tenantId.trim());
  const defaultDoctorStaffId =
    session != null ? await resolveDefaultDoctorStaffIdForFiUser(tenantId.trim(), session.fiUserId) : null;

  const [catalogue, staff] = await Promise.all([
    loadMedicationCatalogueForTenant(tenantId.trim()),
    loadCrmShellStaffPickerOptions(tenantId.trim()),
  ]);

  if (catalogue.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-sm text-slate-700">
        <p>No medication catalogue rows for this tenant yet.</p>
        <p className="mt-2 text-xs text-slate-500">Apply the latest Supabase migrations to create and seed `fi_medication_catalogue`.</p>
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-sm text-slate-700">
        <p>Add at least one active staff member (Settings → Staff) before creating prescriptions.</p>
      </div>
    );
  }

  const staffOptions = staff.map((s) => ({
    id: s.id,
    label: `${s.full_name?.trim() || "Staff"} (${s.staff_role})`,
  }));

  const doctorId =
    defaultDoctorStaffId && staff.some((s) => s.id === defaultDoctorStaffId)
      ? defaultDoctorStaffId
      : staff[0]!.id;

  return (
    <PrescriptionEditorClient
      tenantId={tenantId.trim()}
      patientId={patientId.trim()}
      caseId={caseId}
      initialPrescriptionId={null}
      initialStatus="draft"
      initialDoctorId={doctorId}
      initialClinicalNotes=""
      initialDeliveryType=""
      initialPatientShippingAddress=""
      initialPharmacyName=""
      initialReadyForPharmacyAt={null}
      initialSignedAt={null}
      initialItems={[]}
      catalogue={catalogue}
      staffOptions={staffOptions}
      initialEvents={[]}
    />
  );
}
