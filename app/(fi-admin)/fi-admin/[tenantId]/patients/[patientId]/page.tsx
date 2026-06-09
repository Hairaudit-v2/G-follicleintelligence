import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UniversalPatientRecord } from "@/src/components/fi/UniversalPatientRecord";
import { PatientPrescriptionsTab } from "@/src/components/fi-admin/prescribing/PatientPrescriptionsTab";
import { PatientDetailPageView } from "@/src/components/fi/patients/detail/PatientDetailPageView";
import { AppointmentSlideOverProvider } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { loadUniversalPatientRecord } from "@/src/lib/fi/foundation/patientRecord";
import { getClinicFloorPageSession } from "@/src/lib/staffPin/clinicFloorAccess";
import { loadPatientDetailPayload } from "@/src/lib/patients/patientDetailLoader";
import { parsePatientDetailTab } from "@/src/lib/patients/patientDetailTabs";
import { parsePatientPreviewSearchParam } from "@/src/lib/patients/patientPreviewQuery";
import { loadPatientProfile } from "@/src/lib/patients/patientProfileLoader";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}): Promise<Metadata> {
  const { tenantId, patientId } = await params;
  const payload = await loadPatientDetailPayload(tenantId, patientId);
  const title = payload?.displayName ?? "Patient profile";
  return {
    title: `${title} · Patients`,
    robots: { index: false, follow: false },
  };
}

export default async function PatientProfileRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId, patientId } = await params;
  if (!tenantId?.trim() || !patientId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const session = await getClinicFloorPageSession(tenantId);
  const sp = (await searchParams) ?? {};
  const previewPatientId = parsePatientPreviewSearchParam(sp.preview);
  const activeTab = parsePatientDetailTab(sp.tab);

  const loaded = await loadPatientProfile(tenantId, patientId);
  if (!loaded.ok) notFound();

  if (loaded.mode === "legacy_global") {
    const record = await loadUniversalPatientRecord({ tenantId, globalPatientId: loaded.data.globalPatientId });
    if (!record.ok) notFound();
    return (
      <div className="mx-auto max-w-6xl space-y-4 py-6">
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          This URL resolves to a <strong>legacy global patient</strong> without a linked foundation{" "}
          <code className="rounded bg-amber-100/80 px-1">fi_patients</code> row. Showing the universal read-only aggregate
          until ingest maps a foundation patient.
        </p>
        <UniversalPatientRecord tenantId={tenantId} patientSlug={loaded.data.globalPatientId} record={record} />
      </div>
    );
  }

  const payload = await loadPatientDetailPayload(tenantId, patientId);
  if (!payload) notFound();

  const services = await loadFiServicesForTenant(tenantId.trim());

  return (
    <AppointmentSlideOverProvider
      tenantId={tenantId}
      operatorFiUserId={session.fiUserId}
      userRole={session.role}
      canUseClinicFeatures={session.canUseClinicFeatures}
      assignees={payload.assignees}
      clinics={payload.clinics}
      existingBookings={payload.bookingRows}
      calendarTimezone={payload.calendarTimezone}
      services={services}
    >
      <Suspense fallback={<div className="mx-auto max-w-6xl animate-pulse space-y-4 py-6" aria-busy="true" aria-hidden />}>
        <PatientDetailPageView
          tenantId={tenantId}
          patientId={patientId.trim()}
          initialPayload={payload}
          activeTab={activeTab}
          previewPatientId={previewPatientId}
          prescriptionsTab={
            activeTab === "prescriptions" ? (
              <Suspense
                fallback={
                  <div className="mx-auto max-w-6xl animate-pulse rounded border border-gray-200 bg-white py-12" aria-hidden />
                }
              >
                <PatientPrescriptionsTab tenantId={tenantId} patientId={patientId.trim()} />
              </Suspense>
            ) : null
          }
        />
      </Suspense>
    </AppointmentSlideOverProvider>
  );
}
