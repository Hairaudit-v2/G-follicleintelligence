import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { UniversalPatientRecord } from "@/src/components/fi/UniversalPatientRecord";
import { loadUniversalPatientRecord } from "@/src/lib/fi/foundation/patientRecord";

export const dynamic = "force-dynamic";

export default async function UniversalPatientRecordPage({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string }>;
}) {
  const { tenantId, patientId } = await params;
  if (!tenantId?.trim() || !patientId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (te || !tenant) notFound();

  const record = await loadUniversalPatientRecord({ tenantId, patientId });
  if (!record.ok) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-gray-900">Universal patient record</h1>
        <p className="mt-1 max-w-3xl text-xs text-gray-600">
          Read-only aggregate across foundation patients, global stubs, cases, timeline, and media for this tenant.
          The path id may be a foundation <code className="rounded bg-gray-100 px-1">fi_patients.id</code> or a{" "}
          <code className="rounded bg-gray-100 px-1">fi_global_patients.id</code>; the loader resolves both.
        </p>
      </div>
      <UniversalPatientRecord tenantId={tenantId} patientSlug={patientId} record={record} />
    </div>
  );
}
