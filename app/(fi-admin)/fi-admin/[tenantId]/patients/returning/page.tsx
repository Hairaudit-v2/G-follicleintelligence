import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ReturningPatientFollowUpClient } from "@/src/components/fi-admin/patients/ReturningPatientFollowUpClient";
import { getClinicFloorPageSession } from "@/src/lib/staffPin/clinicFloorAccess";

export const metadata = {
  title: "Returning patient follow-up",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReturningPatientFollowUpPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await getClinicFloorPageSession(tenantId);

  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading…</p>}>
      <ReturningPatientFollowUpClient tenantId={tenantId} />
    </Suspense>
  );
}
