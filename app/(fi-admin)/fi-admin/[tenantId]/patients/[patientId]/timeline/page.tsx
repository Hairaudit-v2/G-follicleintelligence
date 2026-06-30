import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PatientTimeline } from "@/src/components/fi/patients/PatientTimeline";
import { getClinicFloorPageSession } from "@/src/lib/staffPin/clinicFloorAccess";
import { loadPatientTimeline } from "@/src/lib/integrations/hubspot/loadPatientTimeline.server";
import { loadPatientDetailPayload } from "@/src/lib/patients/patientDetailLoader";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}): Promise<Metadata> {
  const { tenantId, patientId } = await params;
  const payload = await loadPatientDetailPayload(tenantId, patientId).catch(() => null);
  const title = payload?.displayName ?? "Patient";
  return {
    title: `${title} · Timeline`,
    robots: { index: false, follow: false },
  };
}

export default async function PatientTimelineRoutePage({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}) {
  const { tenantId, patientId } = await params;
  if (!tenantId?.trim() || !patientId?.trim()) notFound();

  // Tenant access gate (redirects/throws when the operator lacks access).
  await getClinicFloorPageSession(tenantId);

  const result = await loadPatientTimeline(tenantId, patientId).catch(() => null);
  if (!result?.ok) notFound();

  const payload = await loadPatientDetailPayload(tenantId, patientId).catch(() => null);
  const displayName = payload?.displayName ?? "Patient";

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Activity timeline
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-100">{displayName}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Communication and CRM activity history synced from external systems (read-only).
          </p>
        </div>
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}`}
          className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/[0.03]"
        >
          Back to patient
        </Link>
      </div>

      <PatientTimeline rows={result.rows} />
    </div>
  );
}
