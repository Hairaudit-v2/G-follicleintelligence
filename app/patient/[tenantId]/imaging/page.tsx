import { notFound } from "next/navigation";

import { PatientPortalAccessNotice } from "@/src/components/patient-portal/PatientPortalAccessNotice";
import { PatientImagingPortalClient } from "@/src/components/patient-portal/PatientImagingPortalClient";
import { loadPatientSafeImagingExportCardsForPatient } from "@/src/lib/imaging-os/patientSafeImagingExportLoad.server";
import { resolvePatientPortalAccess } from "@/src/lib/patientPortal/patientPortalAccess.server";

export const dynamic = "force-dynamic";

export default async function PatientImagingPortalPage({
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

  const bundle = await loadPatientSafeImagingExportCardsForPatient({
    tenantId: tid,
    patientId: access.patientId,
    includeSignedPreviews: true,
    limit: 30,
  });

  return <PatientImagingPortalClient cards={bundle.cards} />;
}