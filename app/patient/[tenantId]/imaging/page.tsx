import { notFound } from "next/navigation";

import { PatientPortalAccessNotice } from "@/src/components/patient-portal/PatientPortalAccessNotice";
import { PatientImagingPortalClient } from "@/src/components/patient-portal/PatientImagingPortalClient";
import { loadPatientSafeImagingExportCardsForPatient } from "@/src/lib/imaging-os/patientSafeImagingExportLoad.server";
import { resolvePatientPortalAccess } from "@/src/lib/patientPortal/patientPortalAccess.server";
import { isPatientPortalImagingEnabled } from "@/src/lib/patientPortal/patientPortalImagingEnabled";

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

  if (!isPatientPortalImagingEnabled()) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-slate-100">Clinical photography</h1>
        <p className="text-sm text-slate-400">
          Patient portal imaging is not enabled for this environment. Contact the clinic if you
          expected to view or upload photos here.
        </p>
      </div>
    );
  }

  const bundle = await loadPatientSafeImagingExportCardsForPatient({
    tenantId: tid,
    patientId: access.patientId,
    includeSignedPreviews: true,
    limit: 30,
  });

  return (
    <PatientImagingPortalClient
      tenantId={tid}
      cards={bundle.cards}
      canUpload={access.status === "linked"}
    />
  );
}