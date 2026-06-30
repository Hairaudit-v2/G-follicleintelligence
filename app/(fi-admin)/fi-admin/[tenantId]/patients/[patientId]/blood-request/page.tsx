import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BloodPathologyRequestClient } from "@/src/components/fi/patients/pathology/BloodPathologyRequestClient";
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
    title: `${name?.trim() ? name.trim() : "Patient"} · Blood request`,
    robots: { index: false, follow: false },
  };
}

export default async function PatientBloodRequestPage({
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

  const defaultRequestDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <p className="text-sm text-slate-400">
        <Link href={`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`} className="text-blue-300 hover:underline">
          ← Patient profile
        </Link>
      </p>
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-100">Request blood tests</h1>
        <p className="text-sm text-slate-400">
          DoctorOS pathology request (Stage 1). Panels are stored with this patient; external lab / eOrder integrations
          are not enabled yet.
        </p>
      </header>
      <BloodPathologyRequestClient
        tenantId={tenantId.trim()}
        patientId={patientId.trim()}
        defaultRequestDate={defaultRequestDate}
      />
    </div>
  );
}
