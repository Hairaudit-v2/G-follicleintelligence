import { notFound } from "next/navigation";

import { PatientPortalAccessNotice } from "@/src/components/patient-portal/PatientPortalAccessNotice";
import { PatientMedicationsPortalClient } from "@/src/components/patient-portal/PatientMedicationsPortalClient";
import { resolvePatientPortalAccess } from "@/src/lib/patientPortal/patientPortalAccess.server";
import {
  loadMedicationPortalLines,
  loadMedicationReorderRequestsForPatient,
} from "@/src/lib/medicationReorder/medicationReorderLoaders.server";

export const dynamic = "force-dynamic";

export default async function PatientMedicationsPage({
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

  const [lines, requests] = await Promise.all([
    loadMedicationPortalLines(tid, access.patientId),
    loadMedicationReorderRequestsForPatient(tid, access.patientId),
  ]);

  return <PatientMedicationsPortalClient tenantId={tid} lines={lines} requests={requests} />;
}
