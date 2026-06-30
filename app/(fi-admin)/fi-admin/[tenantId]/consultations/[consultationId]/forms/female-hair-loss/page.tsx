import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsultationFormRunner } from "@/src/components/fi-admin/consultation-forms/ConsultationFormRunner";
import { loadConsultationForTenant } from "@/src/lib/consultations/consultationLoaders.server";
import { loadConsultationHandoffState } from "@/src/lib/consultationForms/handoff/consultationHandoffMutations.server";
import { ensureInRoomFemaleHairLossConsultationFormInstance } from "@/src/lib/consultationForms/consultationFormMutations.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadTrialConsentGateStatus } from "@/src/lib/patients/patientConsentGate.server";

export const metadata = {
  title: "Female hair loss consultation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FemaleHairLossGuidedFormPage({
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

  const instance = await ensureInRoomFemaleHairLossConsultationFormInstance(tid, cid);

  const [handoffInitial, trialConsentGate] = await Promise.all([
    loadConsultationHandoffState(tid, cid, instance.id),
    loadTrialConsentGateStatus(tid, row.patient_id),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="mb-4 text-sm text-slate-400">
        ConsultationOS pathway 3 — female-context hair loss, hormonal screening, and Hair Longevity
        / Patient Twin alignment. For general non-surgical intake, use{" "}
        <Link
          href={`/fi-admin/${tid}/consultations/${cid}/forms/hair-loss-treatment`}
          className="font-semibold text-emerald-300 underline"
        >
          Hair Loss Treatment / HLI
        </Link>
        ; for transplant planning, use the{" "}
        <Link
          href={`/fi-admin/${tid}/consultations/${cid}/forms`}
          className="font-semibold text-emerald-300 underline"
        >
          hair transplant guided form
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
        trialConsentGate={trialConsentGate}
      />
    </div>
  );
}
