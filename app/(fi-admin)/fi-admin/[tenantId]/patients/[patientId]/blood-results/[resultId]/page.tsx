import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BloodPathologyResultDetailClient } from "@/src/components/fi/patients/pathology/BloodPathologyResultDetailClient";
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { loadLatestPathologyAiInterpretation } from "@/src/lib/pathology/pathologyAiInterpretationLoad.server";
import {
  loadPathologyRequestOptionsForPatient,
  loadPathologyResultDetail,
} from "@/src/lib/pathology/pathologyResultLoad.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string; resultId: string }>;
}): Promise<Metadata> {
  const { tenantId, patientId, resultId } = await params;
  const bundle = await loadPathologyResultDetail(tenantId, patientId, resultId);
  return {
    title: bundle ? `Blood result · ${bundle.result.result_date}` : "Blood result",
    robots: { index: false, follow: false },
  };
}

export default async function PatientBloodResultDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; patientId: string; resultId: string }>;
}) {
  const { tenantId, patientId, resultId } = await params;
  if (!tenantId?.trim() || !patientId?.trim() || !resultId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <p className="text-sm text-rose-300">Server misconfigured (Supabase).</p>;
  }

  await assertCrmTenantReadAllowed({ tenantId: tenantId.trim() });

  const bundle = await loadPathologyResultDetail(
    tenantId.trim(),
    patientId.trim(),
    resultId.trim()
  );
  if (!bundle) notFound();

  const requestOptions = await loadPathologyRequestOptionsForPatient(
    tenantId.trim(),
    patientId.trim()
  );
  const aiInterpretation = await loadLatestPathologyAiInterpretation(
    tenantId.trim(),
    patientId.trim(),
    resultId.trim()
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <p className="text-sm text-slate-400">
        <Link
          href={`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`}
          className="text-blue-300 hover:underline"
        >
          ← Patient profile
        </Link>
        <span className="mx-2 text-gray-300">·</span>
        <Link
          href={`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}/blood-results/new`}
          className="text-blue-300 hover:underline"
        >
          New result
        </Link>
      </p>
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-100">Blood result</h1>
        <p className="text-sm text-slate-400">
          Result date {bundle.result.result_date} · {bundle.result.status}
        </p>
      </header>
      <BloodPathologyResultDetailClient
        tenantId={tenantId.trim()}
        patientId={patientId.trim()}
        bundle={bundle}
        requestOptions={requestOptions}
        aiInterpretation={aiInterpretation}
      />
    </div>
  );
}
