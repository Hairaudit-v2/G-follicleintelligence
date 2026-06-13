import { notFound } from "next/navigation";

import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { ConsultationOsEditPage } from "@/src/components/fi-admin/consultations/ConsultationOsEditPage";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadConsultationForTenant, loadConsultationWorkspaceDisplay } from "@/src/lib/consultations/consultationLoaders.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";
import { loadPaymentRecordsForConsultationId } from "@/src/lib/payments/paymentRecordLoaders.server";
import { loadLatestConsultationChecklistForPatientWorkspace } from "@/src/lib/patientTwin/patientTwinConsultationChecklist.server";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";

export const metadata = {
  title: "Consultation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConsultationOsEditRoutePage({
  params,
}: {
  params: Promise<{ tenantId: string; consultationId: string }>;
}) {
  const { tenantId, consultationId } = await params;
  if (!tenantId?.trim() || !consultationId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  const row = await loadConsultationForTenant(tenantId, consultationId);
  if (!row) notFound();

  const tid = tenantId.trim();
  const cid = consultationId.trim();
  const [showCrmNav, initialWorkspaceDisplay, clinicalStaffOptions, calendarSettings, initialPaymentRecords, payCap] =
    await Promise.all([
      getCrmShellNavAllowed(tid),
      loadConsultationWorkspaceDisplay(tid, row),
      loadClinicalStaffPickerOptions(tid),
      loadTenantOperationalCalendarSettings(tid),
      loadPaymentRecordsForConsultationId(tid, cid),
      getPaymentRecordMutationCapability(tid),
    ]);
  const operationalTodayYmd = calendarDateStringFromInstant(new Date(), calendarSettings.calendarTimezone);

  const patientIdForChecklist = row.patient_id?.trim() ?? null;
  const initialConsultationChecklistPreview =
    patientIdForChecklist != null
      ? await loadLatestConsultationChecklistForPatientWorkspace(tid, patientIdForChecklist).catch(() => null)
      : null;

  return (
    <ConsultationOsEditPage
      tenantId={tid}
      consultationId={cid}
      initialRow={row}
      initialWorkspaceDisplay={initialWorkspaceDisplay}
      showCrmNav={showCrmNav}
      clinicalStaffOptions={clinicalStaffOptions}
      operationalTodayYmd={operationalTodayYmd}
      initialPaymentRecords={initialPaymentRecords}
      canMutatePaymentRecords={payCap.canMutate}
      initialConsultationChecklistPreview={initialConsultationChecklistPreview}
    />
  );
}
