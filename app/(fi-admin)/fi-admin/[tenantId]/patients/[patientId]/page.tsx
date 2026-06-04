import { notFound } from "next/navigation";
import { UniversalPatientRecord } from "@/src/components/fi/UniversalPatientRecord";
import { PatientProfilePage } from "@/src/components/fi/patients/PatientProfilePage";
import { loadUniversalPatientRecord } from "@/src/lib/fi/foundation/patientRecord";
import { assertCrmShellPageAccess } from "@/src/lib/crm/crmShellAccess";
import { loadPatientProfile } from "@/src/lib/patients/patientProfileLoader";

export const metadata = {
  title: "Patient profile",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PatientProfileRoutePage({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}) {
  const { tenantId, patientId } = await params;
  if (!tenantId?.trim() || !patientId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  await assertCrmShellPageAccess(tenantId);

  const loaded = await loadPatientProfile(tenantId, patientId);
  if (!loaded.ok) notFound();

  if (loaded.mode === "legacy_global") {
    const record = await loadUniversalPatientRecord({ tenantId, globalPatientId: loaded.data.globalPatientId });
    if (!record.ok) notFound();
    return (
      <div className="mx-auto max-w-6xl space-y-4 py-6">
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          This URL resolves to a <strong>legacy global patient</strong> without a linked foundation{" "}
          <code className="rounded bg-amber-100/80 px-1">fi_patients</code> row. Showing the universal read-only aggregate
          until ingest maps a foundation patient.
        </p>
        <UniversalPatientRecord tenantId={tenantId} patientSlug={loaded.data.globalPatientId} record={record} />
      </div>
    );
  }

  return <PatientProfilePage tenantId={tenantId} data={loaded.data} />;
}
