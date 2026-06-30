import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsultationFormRunner } from "@/src/components/fi-admin/consultation-forms/ConsultationFormRunner";
import { loadConsultationForTenant } from "@/src/lib/consultations/consultationLoaders.server";
import { loadConsultationHandoffState } from "@/src/lib/consultationForms/handoff/consultationHandoffMutations.server";
import { ensureInRoomHairTransplantRepairConsultationFormInstance } from "@/src/lib/consultationForms/consultationFormMutations.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Hair transplant repair consultation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function HairTransplantRepairGuidedFormPage({
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

  const instance = await ensureInRoomHairTransplantRepairConsultationFormInstance(tid, cid);

  const handoffInitial = await loadConsultationHandoffState(tid, cid, instance.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="mb-4 text-sm text-slate-400">
        ConsultationOS pathway 4 — dedicated repair / revision intake (prior surgery audit, donor & recipient risk, HairAudit +
        SurgeryOS routing). For primary transplant planning, use the{" "}
        <Link href={`/fi-admin/${tid}/consultations/${cid}/forms`} className="font-semibold text-emerald-300 underline">
          standard hair transplant form
        </Link>
        .
      </p>
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
