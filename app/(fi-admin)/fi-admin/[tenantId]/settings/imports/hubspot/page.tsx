import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { HubspotCrmImportCentre } from "@/src/components/fi-admin/settings/HubspotCrmImportCentre";
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { loadHubspotImportBatch } from "@/src/lib/crm/hubspotImport/hubspotImportBatchLoad.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export const metadata = {
  title: "HubSpot CRM import",
  robots: { index: false, follow: false } as const,
};

export const dynamic = "force-dynamic";

export default async function HubspotCrmImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: { batchId?: string };
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);
  if (!(await canViewTenantConfigurationHub(tenantId))) {
    notFound();
  }

  await assertCrmTenantReadAllowed({ tenantId, request: undefined });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (error || !tenant) notFound();

  const batchId =
    typeof searchParams.batchId === "string" && searchParams.batchId.trim() ? searchParams.batchId.trim() : null;
  const batchData = batchId ? await loadHubspotImportBatch(tenantId, batchId) : { batch: null, stagingPreview: [], stagingTotal: 0 };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          <Link href={`/fi-admin/${tenantId}/configuration`} className="text-[#22C1FF] hover:underline">
            Settings
          </Link>{" "}
          / <span className="text-[#94A3B8]">Imports</span> / <span className="text-[#CBD5E1]">HubSpot</span>
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">HubSpot CRM import (Stage 1)</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Upload a HubSpot contacts export, run a dry-run validation, then import up to 100 eligible rows into{" "}
          <code className="rounded bg-[#141C33] px-1 text-xs text-[#22C1FF]">fi_persons</code>, optional{" "}
          <code className="rounded bg-[#141C33] px-1 text-xs text-[#22C1FF]">fi_patients</code>,{" "}
          <code className="rounded bg-[#141C33] px-1 text-xs text-[#22C1FF]">fi_crm_leads</code>, and{" "}
          <code className="rounded bg-[#141C33] px-1 text-xs text-[#22C1FF]">fi_crm_lead_source_ids</code>. All writes use the
          Supabase service role on the server after access checks.
        </p>
      </div>

      {batchId && !batchData.batch ? (
        <InfoNotice variant="warning" title="Batch not found">
          <p className="text-sm">No import batch matches this id for the current tenant.</p>
        </InfoNotice>
      ) : null}

      <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
        <HubspotCrmImportCentre tenantId={tenantId} initialBatch={batchData.batch} stagingPreview={batchData.stagingPreview} />
      </Suspense>
    </div>
  );
}
