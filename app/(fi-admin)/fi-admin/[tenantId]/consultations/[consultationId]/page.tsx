import { notFound } from "next/navigation";

import { ConsultationOsEditPage } from "@/src/components/fi-admin/consultations/ConsultationOsEditPage";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import {
  loadConsultationForTenant,
  loadConsultationWorkspaceDisplay,
} from "@/src/lib/consultations/consultationLoaders.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadLatestConsultationChecklistForPatientWorkspace } from "@/src/lib/patientTwin/patientTwinConsultationChecklist.server";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import { loadConsultationFormInstances } from "@/src/lib/consultationForms/consultationFormLoad.server";
import { buildConsultationPathwayLauncherViewModel } from "@/src/lib/consultations/consultationPathwayLauncherModel";

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
  const [showCrmNav, initialWorkspaceDisplay, clinicalStaffOptions, formInstances] =
    await Promise.all([
      getCrmShellNavAllowed(tid),
      loadConsultationWorkspaceDisplay(tid, row),
      loadClinicalStaffPickerOptions(tid),
      loadConsultationFormInstances(tid, cid),
    ]);
  const pathwayLauncher = buildConsultationPathwayLauncherViewModel({
    tenantId: tid,
    consultationId: cid,
    row,
    instances: formInstances,
  });
  const patientIdForChecklist = row.patient_id?.trim() ?? null;
  const initialConsultationChecklistPreview =
    patientIdForChecklist != null
      ? await loadLatestConsultationChecklistForPatientWorkspace(tid, patientIdForChecklist).catch(
          () => null
        )
      : null;

  return (
    <ConsultationOsEditPage
      tenantId={tid}
      consultationId={cid}
      initialRow={row}
      initialWorkspaceDisplay={initialWorkspaceDisplay}
      showCrmNav={showCrmNav}
      clinicalStaffOptions={clinicalStaffOptions}
      initialConsultationChecklistPreview={initialConsultationChecklistPreview}
      pathwayLauncher={pathwayLauncher}
    />
  );
}
