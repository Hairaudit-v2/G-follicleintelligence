import { notFound } from "next/navigation";

import { ConsultationOsEditPage } from "@/src/components/fi-admin/consultations/ConsultationOsEditPage";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import {
  loadConsultationForTenant,
  loadConsultationWorkspaceDisplay,
} from "@/src/lib/consultations/consultationLoaders.server";
import { ensureConsultationPatientFromLead } from "@/src/lib/consultations/consultationMutations.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadLatestConsultationChecklistForPatientWorkspace } from "@/src/lib/patientTwin/patientTwinConsultationChecklist.server";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import { loadConsultationFormInstances } from "@/src/lib/consultationForms/consultationFormLoad.server";
import { buildConsultationPathwayLauncherViewModel } from "@/src/lib/consultations/consultationPathwayLauncherModel";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadConsultationTrichoscopyWorkspace } from "@/src/lib/integrations/hliTrichoscopy/consultation/service.server";
import type { ConsultationTrichoscopyHubInitial } from "@/src/lib/integrations/hliTrichoscopy/consultation/hubInitial";

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

  const tid = tenantId.trim();
  const cid = consultationId.trim();

  // F-PILOT-08: backfill patient_id from linked lead when missing (tenant-scoped, no overwrite).
  let row = await loadConsultationForTenant(tid, cid);
  if (!row) notFound();
  try {
    row = await ensureConsultationPatientFromLead(tid, cid);
  } catch (e) {
    console.error("[ConsultationOsEditRoutePage] ensureConsultationPatientFromLead", e);
  }

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

  let trichoscopyInitial: ConsultationTrichoscopyHubInitial | null = null;
  try {
    const authUserId = await resolveAuthUserId(null);
    if (authUserId) {
      const { data: fiUser } = await supabaseAdmin()
        .from("fi_users")
        .select("id")
        .eq("tenant_id", tid)
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      if (fiUser) {
        const workspace = await loadConsultationTrichoscopyWorkspace({
          tenantId: tid,
          consultationId: cid,
          userId: String((fiUser as { id: string }).id),
        });
        if (workspace.available || workspace.card.failureKind) {
          trichoscopyInitial = {
            available: workspace.available,
            card: workspace.card,
            indication: workspace.indication,
            findings: workspace.findings,
            reviews: workspace.reviews,
            patientSafeSummaryText: workspace.patientSafeSummaryText,
            canRequest: workspace.canRequest,
            canReview: workspace.canReview,
            canAccept: workspace.canAccept,
            historicalReadOnly: workspace.historicalReadOnly,
          };
        }
      }
    }
  } catch (e) {
    console.error("[ConsultationOsEditRoutePage] trichoscopy workspace load", e);
  }

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
      trichoscopyInitial={trichoscopyInitial}
    />
  );
}
