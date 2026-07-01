import { notFound } from "next/navigation";

import { PatientPortalAccessNotice } from "@/src/components/patient-portal/PatientPortalAccessNotice";
import { PatientVisualSummaryPortalClient } from "@/src/components/patient-portal/PatientVisualSummaryPortalClient";
import { loadApprovedPatientVisualSummariesForPortal } from "@/src/lib/imaging-os/patientVisualSummaryPortalLoad.server";
import { resolvePatientPortalAccess } from "@/src/lib/patientPortal/patientPortalAccess.server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Visual summaries · Patient portal",
  robots: { index: false, follow: false },
};

export default async function PatientVisualSummaryPortalPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return <p className="text-sm text-rose-300">Server misconfigured (Supabase).</p>;
  }

  const access = await resolvePatientPortalAccess(tid);
  if (access.status !== "linked") {
    return <PatientPortalAccessNotice tenantId={tid} access={access} />;
  }

  const bundle = await loadApprovedPatientVisualSummariesForPortal({
    tenantId: tid,
    patientId: access.patientId,
  });

  return <PatientVisualSummaryPortalClient items={bundle.items} />;
}