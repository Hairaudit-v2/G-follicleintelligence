import { notFound } from "next/navigation";

import { ConsultationFormRunner } from "@/src/components/fi-admin/consultation-forms/ConsultationFormRunner";
import { loadConsultationForTenant } from "@/src/lib/consultations/consultationLoaders.server";
import { loadConsultationHandoffState } from "@/src/lib/consultationForms/handoff/consultationHandoffMutations.server";
import { ensureInRoomHairTransplantConsultationFormInstance } from "@/src/lib/consultationForms/consultationFormMutations.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Consultation form",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConsultationGuidedFormPage({
  params,
}: {
  params: Promise<{ tenantId: string; consultationId: string }>;
}) {
  const { tenantId, consultationId } = await params;
  if (!tenantId?.trim() || !consultationId?.trim()) notFound();

  const tid = tenantId.trim();
  const cid = consultationId.trim();

  await assertFiTenantPortalAccess(tid);

  const row = await loadConsultationForTenant(tid, cid);
  if (!row) notFound();

  const instance = await ensureInRoomHairTransplantConsultationFormInstance(tid, cid);

  const handoffInitial = await loadConsultationHandoffState(tid, cid, instance.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <ConsultationFormRunner
        tenantId={tid}
        consultationId={cid}
        patientId={row.patient_id}
        caseId={row.case_id}
        leadId={row.lead_id}
        handoffInitial={handoffInitial}
        initialInstance={instance}
      />
    </div>
  );
}
