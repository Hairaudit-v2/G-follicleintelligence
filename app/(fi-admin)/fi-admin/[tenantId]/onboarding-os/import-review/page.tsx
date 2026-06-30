import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { ImportReviewPanel } from "@/src/components/onboarding-os/ImportReviewPanel";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { canViewTenantExternalConnectors } from "@/src/lib/onboarding-os/externalConnector.server";
import { loadHubspotIntegrationForTenant } from "@/src/lib/onboarding-os/hubspotImport.server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Import review — OnboardingOS",
  robots: { index: false, follow: false },
};

export default async function OnboardingOsImportReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ integrationId?: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const sp = await searchParams;

  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);
  if (!(await canViewTenantExternalConnectors(tenantId))) {
    notFound();
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();
  if (te || !tenant) notFound();

  let integrationId = typeof sp.integrationId === "string" ? sp.integrationId.trim() : "";
  let integrationLabel = "HubSpot";

  if (!integrationId) {
    const loaded = await loadHubspotIntegrationForTenant(tenantId, { skipAuthCheck: true });
    if (loaded.ok && loaded.data) {
      integrationId = loaded.data.integrationId;
      integrationLabel = loaded.data.label;
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">
          OnboardingOS import review
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Convert approved connector staging records into native FI leads and opportunities. Every
          import requires explicit human approval — no automatic import, no HubSpot write-back, and
          no overwrite of existing FI records.
        </p>
      </div>
      <ImportReviewPanel
        tenantId={tenantId}
        integrationId={integrationId || null}
        integrationLabel={integrationLabel}
      />
    </div>
  );
}
