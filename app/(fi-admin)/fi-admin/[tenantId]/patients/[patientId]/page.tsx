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
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";
import { loadPaymentRecordsForPatientId } from "@/src/lib/payments/paymentRecordLoaders.server";
import { loadPatientInvoiceSummary } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import { getPatientImagingCaptureCapability } from "@/src/lib/patientImages/patientImagingCaptureAccess.server";
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
    return <p className="text-sm text-rose-300">Server misconfigured (Supabase).</p>;
  }

  const session = await getClinicFloorPageSession(tenantId);
  const sp = (await searchParams) ?? {};
  const previewPatientId = parsePatientPreviewSearchParam(sp.preview);
  const activeTab = parsePatientDetailTab(sp.tab);

  const loaded = await loadPatientProfile(tenantId, patientId);
  if (!loaded.ok) notFound();

  if (loaded.mode === "legacy_global") {
    const record = await loadUniversalPatientRecord({
      tenantId,
      globalPatientId: loaded.data.globalPatientId,
    });
    if (!record.ok) notFound();
    return (
      <div className="mx-auto max-w-6xl space-y-4 py-6">
        <p className="rounded border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">
          This URL resolves to a <strong>legacy global patient</strong> without a linked foundation{" "}
          <code className="rounded bg-amber-400/15 px-1">fi_patients</code> row. Showing the
          universal read-only aggregate until ingest maps a foundation patient.
        </p>
        <UniversalPatientRecord
          tenantId={tenantId}
          patientSlug={loaded.data.globalPatientId}
          record={record}
        />
      </div>
    );
  }

  const payload = await loadPatientDetailPayload(tenantId, patientId);
  if (!payload) notFound();

  const [
    services,
    clinicalStaffOptions,
    calendarSettings,
    initialPaymentRecords,
    payCap,
    patientInvoiceSummary,
    imagingCaptureCap,
  ] = await Promise.all([
    loadFiServicesForTenant(tenantId.trim()),
    loadClinicalStaffPickerOptions(tenantId.trim()),
    loadTenantOperationalCalendarSettings(tenantId.trim()),
    loadPaymentRecordsForPatientId(tenantId.trim(), patientId.trim()),
    getPaymentRecordMutationCapability(tenantId.trim()),
    loadPatientInvoiceSummary(tenantId.trim(), patientId.trim()),
    getPatientImagingCaptureCapability(tenantId.trim()),
  ]);
  const operationalTodayYmd = calendarDateStringFromInstant(
    new Date(),
    calendarSettings.calendarTimezone
  );

  return (
    <AppointmentSlideOverProvider
      tenantId={tenantId}
      operatorFiUserId={session.fiUserId}
      userRole={session.role}
      canUseClinicFeatures={session.canUseClinicFeatures}
      assignees={clinicalStaffOptions}
      clinics={payload.clinics}
      existingBookings={payload.bookingRows}
      calendarTimezone={payload.calendarTimezone}
      services={services}
    >
      <Suspense
        fallback={
          <div
            className="mx-auto max-w-6xl animate-pulse space-y-4 py-6"
            aria-busy="true"
            aria-hidden
          />
        }
      >
        <PatientDetailPageView
          tenantId={tenantId}
          patientId={patientId.trim()}
          initialPayload={payload}
          activeTab={activeTab}
          previewPatientId={previewPatientId}
          operationalTodayYmd={operationalTodayYmd}
          initialPaymentRecords={initialPaymentRecords}
          canMutatePaymentRecords={payCap.canMutate}
          patientInvoiceSummary={patientInvoiceSummary}
          canCapturePatientPhotos={imagingCaptureCap.canCapture}
          prescriptionsTab={
            activeTab === "prescriptions" ? (
              <Suspense
                fallback={
                  <div
                    className="mx-auto max-w-6xl animate-pulse rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md py-12"
                    aria-hidden
                  />
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
