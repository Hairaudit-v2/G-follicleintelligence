import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BloodPathologyResultNewClient } from "@/src/components/fi/patients/pathology/BloodPathologyResultNewClient";
import { loadPathologyRequestOptionsForPatient } from "@/src/lib/pathology/pathologyResultLoad.server";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { loadPatientProfile } from "@/src/lib/patients/patientProfileLoader";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}): Promise<Metadata> {
  const { tenantId, patientId } = await params;
  const loaded = await loadPatientProfile(tenantId, patientId);
  const name =
    loaded.ok && loaded.mode === "foundation" ? displayFromPersonMetadata(loaded.data.person.metadata).name : null;
  return {
    title: `${name?.trim() ? name.trim() : "Patient"} · Upload blood results`,
    robots: { index: false, follow: false },
  };
}

export default async function PatientBloodResultsNewPage({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}) {
  const { tenantId, patientId } = await params;
  if (!tenantId?.trim() || !patientId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <p className="text-sm text-rose-300">Server misconfigured (Supabase).</p>;
  }

  const loaded = await loadPatientProfile(tenantId, patientId);
  if (!loaded.ok || loaded.mode !== "foundation") notFound();

  const requestOptions = await loadPathologyRequestOptionsForPatient(tenantId.trim(), patientId.trim());
  const defaultResultDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <p className="text-sm text-slate-400">
        <Link href={`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`} className="text-blue-600 hover:underline">
          ← Patient profile
        </Link>
      </p>
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-100">Upload blood results</h1>
        <p className="text-sm text-slate-400">
          DoctorOS pathology results (Stage 3). Attach a lab PDF and/or enter structured markers. OCR and lab integrations
          are not enabled yet.
        </p>
      </header>
      <BloodPathologyResultNewClient
        tenantId={tenantId.trim()}
        patientId={patientId.trim()}
        defaultResultDate={defaultResultDate}
        requestOptions={requestOptions}
      />
    </div>
  );
}
