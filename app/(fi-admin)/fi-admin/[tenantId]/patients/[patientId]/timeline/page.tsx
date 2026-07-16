import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PatientJourney } from "@/src/components/fi/patients/PatientJourney";
import { PatientTimeline } from "@/src/components/fi/patients/PatientTimeline";
import { getClinicFloorPageSession } from "@/src/lib/staffPin/clinicFloorAccess";
import { loadPatientTimeline } from "@/src/lib/integrations/hubspot/loadPatientTimeline.server";
import { loadPatientDetailPayload } from "@/src/lib/patients/patientDetailLoader";
import { loadPatientJourneyView } from "@/src/lib/patients/journey/patientJourney.server";

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
    title: `${title} · Journey & timeline`,
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

  await getClinicFloorPageSession(tenantId);

  const [journeyResult, hubspotResult, payload] = await Promise.all([
    loadPatientJourneyView(tenantId, patientId).catch(() => null),
    loadPatientTimeline(tenantId, patientId).catch(() => null),
    loadPatientDetailPayload(tenantId, patientId).catch(() => null),
  ]);

  const displayName = payload?.displayName ?? "Patient";

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Journey & timeline
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-100">{displayName}</h1>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            Visual journey of recorded photos, scale fields, and milestones — plus synced CRM
            activity when available.
          </p>
        </div>
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}`}
          className="inline-flex min-h-10 items-center rounded-lg border border-white/[0.08] bg-[#0F1629]/80 px-3 py-1.5 text-sm font-medium text-slate-300 backdrop-blur-md hover:bg-white/[0.03]"
        >
          Back to patient
        </Link>
      </div>

      {journeyResult?.ok ? (
        <PatientJourney journey={journeyResult.journey} />
      ) : (
        <p className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4 text-sm text-slate-400">
          Visual journey could not be loaded for this record. The communication timeline below may
          still be available.
        </p>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Communication & CRM activity</h2>
          <p className="mt-1 text-xs text-slate-500">
            Read-only history synced from external systems (e.g. HubSpot) when configured.
          </p>
        </div>
        {hubspotResult?.ok ? (
          <PatientTimeline rows={hubspotResult.rows} />
        ) : (
          <div className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 p-6 text-sm text-gray-500 backdrop-blur-md">
            No communication or CRM activity has been synced for this patient yet.
          </div>
        )}
      </section>
    </div>
  );
}
