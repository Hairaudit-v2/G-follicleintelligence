import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsultationFormRunner } from "@/src/components/fi-admin/consultation-forms/ConsultationFormRunner";
import { loadConsultationForTenant } from "@/src/lib/consultations/consultationLoaders.server";
import { loadConsultationHandoffState } from "@/src/lib/consultationForms/handoff/consultationHandoffMutations.server";
import { ensureInRoomScalpPathologyConsultationFormInstance } from "@/src/lib/consultationForms/consultationFormMutations.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Scalp disorder / pathology consultation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ScalpPathologyGuidedFormPage({
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

  const instance = await ensureInRoomScalpPathologyConsultationFormInstance(tid, cid);

  const handoffInitial = await loadConsultationHandoffState(tid, cid, instance.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="mb-4 text-sm text-slate-400">
        Scalp disorder / pathology pathway (HLI + pathology + Patient Twin). For pattern male hair loss without scalp
        disease features, use{" "}
        <Link href={`/fi-admin/${tid}/consultations/${cid}/forms/hair-loss-treatment`} className="font-semibold text-violet-300 underline">
          hair loss treatment
        </Link>
        ; for female-context assessment, use{" "}
        <Link href={`/fi-admin/${tid}/consultations/${cid}/forms/female-hair-loss`} className="font-semibold text-violet-300 underline">
          female hair loss
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
