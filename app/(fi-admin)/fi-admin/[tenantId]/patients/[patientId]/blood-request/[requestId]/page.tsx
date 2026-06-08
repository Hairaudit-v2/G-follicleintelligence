import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BloodPathologyRequestDetailClient } from "@/src/components/fi/patients/pathology/BloodPathologyRequestDetailClient";
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { loadPathologyRequestAuditEvents, loadPathologyRequestDetail } from "@/src/lib/pathology/pathologyRequestLoad.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string; requestId: string }>;
}): Promise<Metadata> {
  const { tenantId, patientId, requestId } = await params;
  const bundle = await loadPathologyRequestDetail(tenantId, patientId, requestId);
  return {
    title: bundle ? `${bundle.patientName} · Blood request` : "Blood request",
    robots: { index: false, follow: false },
  };
}

export default async function BloodPathologyRequestDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string; requestId: string }>;
}) {
  const { tenantId, patientId, requestId } = await params;
  if (!tenantId?.trim() || !patientId?.trim() || !requestId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  await assertCrmTenantReadAllowed({ tenantId: tenantId.trim() });

  const bundle = await loadPathologyRequestDetail(tenantId.trim(), patientId.trim(), requestId.trim());
  if (!bundle) notFound();

  const auditRaw = await loadPathologyRequestAuditEvents(tenantId.trim(), patientId.trim(), requestId.trim());
  const audit = auditRaw.map((a) => ({
    id: a.id,
    occurred_at: a.occurred_at,
    activity_kind: a.activity_kind,
    title: a.title,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <p className="text-sm text-gray-600">
        <Link href={`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`} className="text-blue-600 hover:underline">
          ← Patient profile
        </Link>
        <span className="mx-2 text-gray-300">·</span>
        <Link
          href={`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}/blood-request`}
          className="text-blue-600 hover:underline"
        >
          New request
        </Link>
      </p>
      <BloodPathologyRequestDetailClient
        tenantId={tenantId.trim()}
        patientId={patientId.trim()}
        requestId={requestId.trim()}
        bundle={bundle}
        audit={audit}
      />
    </div>
  );
}
