import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PatientPrescriptionsTab } from "@/src/components/fi-admin/prescribing/PatientPrescriptionsTab";
import { PatientDetailPageView } from "@/src/components/fi/patients/detail/PatientDetailPageView";
import { AppointmentSlideOverProvider } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { getClinicFloorPageSession } from "@/src/lib/staffPin/clinicFloorAccess";
import { isClinicalPhiReadRole } from "@/src/lib/crm/crmGatePolicy";
import { loadPatientDetailPayload } from "@/src/lib/patients/patientDetailLoader";
import { parsePatientDetailTab } from "@/src/lib/patients/patientDetailTabs";
import { parsePatientPreviewSearchParam } from "@/src/lib/patients/patientPreviewQuery";
import { loadPatientProfile } from "@/src/lib/patients/patientProfileLoader";
import { resolvePatientProfile } from "@/src/lib/patients/resolvePatientProfile.server";
import { patientProfileCacheKey } from "@/src/lib/patients/resolvePatientProfile";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";
import { loadPaymentRecordsForPatientId } from "@/src/lib/payments/paymentRecordLoaders.server";
import { loadPatientInvoiceSummary } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import { getPatientImagingCaptureCapability } from "@/src/lib/patientImages/patientImagingCaptureAccess.server";
import { loadPatientJourneySnapshot } from "@/src/lib/patientJourney/patientJourneyState.server";
import { loadClinicJourneyReadiness } from "@/src/lib/patientJourneyControl/clinicJourneyReadiness.server";
import { canViewPatientSystemAudit } from "@/src/lib/systemAudit/systemAuditAccess.server";
import { listSystemAuditEventsForPatient } from "@/src/lib/systemAudit/systemAuditLoaders.server";
import { loadPatientRequiredConsentsPanelData } from "@/src/lib/consents/consentRequirementResolver.server";
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
  const viewerCanReadClinicalPhi = isClinicalPhiReadRole(session.role);
  const sp = (await searchParams) ?? {};
  const previewPatientId = parsePatientPreviewSearchParam(sp.preview);
  const activeTab = parsePatientDetailTab(sp.tab);

  const resolved = await resolvePatientProfile({
    tenantId,
    patientId,
  });
  if (!resolved.ok) notFound();

  const canonicalPatientId = resolved.data.patientId;
  const cacheKey = patientProfileCacheKey(tenantId, canonicalPatientId);

  const loaded = await loadPatientProfile(tenantId, canonicalPatientId, undefined, {
    viewerCanReadClinicalPhi,
  });
  if (!loaded.ok || loaded.mode !== "foundation") notFound();

  const payload = await loadPatientDetailPayload(tenantId, canonicalPatientId, undefined, {
    viewerCanReadClinicalPhi,
  });
  if (!payload) notFound();

  const [
    services,
    clinicalStaffOptions,
    calendarSettings,
    initialPaymentRecords,
    payCap,
    patientInvoiceSummary,
    imagingCaptureCap,
    patientJourney,
    journeyReadiness,
    requiredConsents,
  ] = await Promise.all([
    loadFiServicesForTenant(tenantId.trim()),
    loadClinicalStaffPickerOptions(tenantId.trim()),
    loadTenantOperationalCalendarSettings(tenantId.trim()),
    loadPaymentRecordsForPatientId(tenantId.trim(), canonicalPatientId),
    getPaymentRecordMutationCapability(tenantId.trim()),
    loadPatientInvoiceSummary(tenantId.trim(), canonicalPatientId),
    getPatientImagingCaptureCapability(tenantId.trim()),
    loadPatientJourneySnapshot(tenantId.trim(), canonicalPatientId).catch(() => null),
    loadClinicJourneyReadiness({
      tenantId: tenantId.trim(),
      patientId: canonicalPatientId,
    }).catch(() => null),
    loadPatientRequiredConsentsPanelData(tenantId.trim(), canonicalPatientId).catch(
      (): import("@/src/lib/consents/consentTypes").PatientRequiredConsentsPanelData => ({
        ok: false,
        unavailable: true,
        message: "Could not load required consents.",
        items: [],
        allRequiredSigned: false,
      })
    ),
  ]);
  const operationalTodayYmd = calendarDateStringFromInstant(
    new Date(),
    calendarSettings.calendarTimezone
  );

  const systemAuditEvents =
    activeTab === "activity" && (await canViewPatientSystemAudit(tenantId.trim()))
      ? await listSystemAuditEventsForPatient(tenantId.trim(), canonicalPatientId, 80)
      : [];

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
          key={cacheKey}
          tenantId={tenantId}
          patientId={canonicalPatientId}
          initialPayload={payload}
          activeTab={activeTab}
          previewPatientId={previewPatientId}
          operationalTodayYmd={operationalTodayYmd}
          initialPaymentRecords={initialPaymentRecords}
          canMutatePaymentRecords={payCap.canMutate}
          patientInvoiceSummary={patientInvoiceSummary}
          canCapturePatientPhotos={imagingCaptureCap.canCapture}
          patientJourney={patientJourney}
          journeyReadiness={journeyReadiness}
          systemAuditEvents={systemAuditEvents}
          requiredConsents={requiredConsents}
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
                <PatientPrescriptionsTab tenantId={tenantId} patientId={canonicalPatientId} />
              </Suspense>
            ) : null
          }
        />
      </Suspense>
    </AppointmentSlideOverProvider>
  );
}
