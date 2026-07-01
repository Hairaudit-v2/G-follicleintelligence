import { notFound, redirect } from "next/navigation";

import { SurgeryBookingWizardClient } from "@/src/components/fi/surgery-booking/SurgeryBookingWizardClient";
import { loadSurgeryBookingPrefillAction } from "@/lib/actions/fi-surgery-booking-actions";
import { getClinicFloorPageSession } from "@/src/lib/staffPin/clinicFloorAccess";

export const dynamic = "force-dynamic";

export default async function SurgeryBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ patientId?: string; caseId?: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await getClinicFloorPageSession(tid);

  const sp = await searchParams;
  const prefillRes = await loadSurgeryBookingPrefillAction({
    tenantId: tid,
    patientId: sp.patientId,
    caseId: sp.caseId,
  });
  if (!prefillRes.ok || !prefillRes.prefill.patientId?.trim()) {
    redirect(`/fi-admin/${tid}/patients`);
  }

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-slate-900/80 shadow-xl">
      <SurgeryBookingWizardClient
        tenantId={tid}
        prefill={{ ...prefillRes.prefill, entrySource: "surgery_booking_route" }}
        cancelHref={`/fi-admin/${tid}/patients`}
      />
    </div>
  );
}