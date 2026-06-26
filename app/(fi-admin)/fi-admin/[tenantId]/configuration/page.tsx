import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { FiTenantBrandFrame } from "@/src/components/fi/FiTenantBrandFrame";
import { TenantConfigurationPanel } from "@/src/components/fi/TenantConfigurationPanel";
import { GuidedAssistUsagePanel } from "@/src/components/onboarding-os/GuidedAssistUsagePanel";
import { TenantConnectExistingSystemsPanel } from "@/src/components/onboarding-os/TenantConnectExistingSystemsPanel";
import { TenantDeploymentIntelligencePanel } from "@/src/components/onboarding-os/TenantDeploymentIntelligencePanel";
import { TenantGoLiveReadinessPanel } from "@/src/components/onboarding-os/TenantGoLiveReadinessPanel";
import {
  loadTenantConfigurationOverview,
  resolveConfigurationPreviewContext,
  resolveEffectiveBranding,
} from "@/src/lib/fi/foundation/tenantSettings";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { canViewTenantExternalConnectors } from "@/src/lib/onboarding-os/externalConnector.server";
import { canViewTenantDeploymentIntelligence } from "@/src/lib/onboarding-os/deploymentIntelligence.server";
import { canViewGuidedAssistUsageSummary } from "@/src/lib/onboarding-os/guidedAssist.server";
import { canViewTenantGoLiveReadiness } from "@/src/lib/onboarding-os/goLiveReadiness.server";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";

export const dynamic = "force-dynamic";

export default async function TenantConfigurationPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: { organisationId?: string; clinicId?: string };
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);
  if (!(await canViewTenantConfigurationHub(tenantId))) {
    notFound();
  }
  await assertStaffModuleAccess(tenantId, "settings", "read");

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (te || !tenant) notFound();

  const organisationId =
    typeof searchParams.organisationId === "string" && searchParams.organisationId.trim()
      ? searchParams.organisationId.trim()
      : null;
  const clinicId =
    typeof searchParams.clinicId === "string" && searchParams.clinicId.trim() ? searchParams.clinicId.trim() : null;

  const overview = await loadTenantConfigurationOverview(tenantId);
  const previewCtx = resolveConfigurationPreviewContext(overview, organisationId, clinicId);
  const effective = await resolveEffectiveBranding({
    tenantId,
    organisationId: previewCtx.organisationId,
    clinicId: previewCtx.clinicId,
  });

  const showCascadePreview = Boolean(previewCtx.organisationId || previewCtx.clinicId);
  const showGuidedAssistUsage = await canViewGuidedAssistUsageSummary(tenantId);
  const showGoLiveReadiness = await canViewTenantGoLiveReadiness(tenantId);
  const showDeploymentIntelligence = await canViewTenantDeploymentIntelligence(tenantId);
  const showExternalConnectors = await canViewTenantExternalConnectors(tenantId);

  return (
    <div className="space-y-4">
      {showCascadePreview ? <FiTenantBrandFrame effective={effective} variant="page-preview" /> : null}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">Configuration</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Tenant-scoped branding and operational defaults. Everyone can review values; saves use the deployment{" "}
          <code className="rounded bg-[#141C33] px-1.5 py-0.5 text-xs text-[#22C1FF]">FI_ADMIN_API_KEY</code> in the operator
          panel below. See design doc 15 (<span className="font-mono text-[#CBD5E1]">15-configuration-admin-editing.md</span>) for fields and access control.
        </p>
      </div>
      {showDeploymentIntelligence ? <TenantDeploymentIntelligencePanel tenantId={tenantId} /> : null}
      {showGoLiveReadiness ? <TenantGoLiveReadinessPanel tenantId={tenantId} /> : null}
      {showExternalConnectors ? <TenantConnectExistingSystemsPanel tenantId={tenantId} /> : null}
      {showGuidedAssistUsage ? <GuidedAssistUsagePanel tenantId={tenantId} /> : null}
      <TenantConfigurationPanel
        tenantId={tenantId}
        overview={overview}
        effective={effective}
        previewOrganisationId={previewCtx.organisationId}
        previewClinicId={previewCtx.clinicId}
        previewFromUrl={Boolean(organisationId || clinicId)}
      />
    </div>
  );
}
