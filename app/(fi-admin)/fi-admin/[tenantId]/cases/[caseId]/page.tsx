import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { UniversalCaseRecord } from "@/src/components/fi/UniversalCaseRecord";
import { loadUniversalCaseRecord } from "@/src/lib/fi/foundation/caseRecord";

export const dynamic = "force-dynamic";

export default async function UniversalCaseRecordPage({
  params,
}: {
  params: Promise<{ tenantId: string; caseId: string }>;
}) {
  const { tenantId, caseId } = await params;
  if (!tenantId?.trim() || !caseId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (te || !tenant) notFound();

  const record = await loadUniversalCaseRecord({ tenantId, caseId });
  if (!record.ok) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-gray-900">Universal case record</h1>
        <p className="mt-1 max-w-3xl text-xs text-gray-600">
          Read-only view of one case across source systems, foundation mappings, timeline, and media. Tenant-scoped;
          identifiers come from <code className="rounded bg-gray-100 px-1">v_fi_case_foundation</code> and related
          tables — not a substitute for per-tenant operational or CRM tools.
        </p>
      </div>
      <UniversalCaseRecord tenantId={tenantId} record={record} />
    </div>
  );
}
