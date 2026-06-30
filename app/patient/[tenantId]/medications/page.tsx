import { notFound } from "next/navigation";

import { PatientMedicationsPortalClient } from "@/src/components/patient-portal/PatientMedicationsPortalClient";
import { loadPatientPortalPatientRow } from "@/src/lib/patientPortal/patientPortalAccess.server";
import {
  loadMedicationPortalLines,
  loadMedicationReorderRequestsForPatient,
} from "@/src/lib/medicationReorder/medicationReorderLoaders.server";

export const dynamic = "force-dynamic";

export default async function PatientMedicationsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return <p className="text-sm text-rose-300">Server misconfigured (Supabase).</p>;
  }

  const portal = await loadPatientPortalPatientRow(tid);
  if (!portal) {
    return (
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
        <p className="font-semibold text-amber-100">Portal not linked</p>
        <p className="mt-2">
          Sign in with Supabase Auth, then ask your clinic to set <code className="rounded bg-white/[0.06] px-1 text-amber-100">portal_auth_user_id</code>{" "}
          on your <code className="rounded bg-white/[0.06] px-1 text-amber-100">fi_patients</code> row to your auth user id for tenant{" "}
          <span className="font-mono">{tid}</span>.
        </p>
      </div>
    );
  }

  const [lines, requests] = await Promise.all([
    loadMedicationPortalLines(tid, portal.patientId),
    loadMedicationReorderRequestsForPatient(tid, portal.patientId),
  ]);

  return (
    <PatientMedicationsPortalClient tenantId={tid} lines={lines} requests={requests} />
  );
}
