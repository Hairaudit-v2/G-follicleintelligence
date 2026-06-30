import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { FiTenantBrandFrame } from "@/src/components/fi/FiTenantBrandFrame";
import { ConfigurationTabNav } from "@/src/components/fi/ConfigurationTabNav";
import { TenantConfigurationPanel } from "@/src/components/fi/TenantConfigurationPanel";
import { CalendarSettingsSection } from "@/src/components/fi-admin/settings/CalendarSettingsSection";
import { GuidedAssistUsagePanel } from "@/src/components/onboarding-os/GuidedAssistUsagePanel";
import { TenantConnectExistingSystemsPanel } from "@/src/components/onboarding-os/TenantConnectExistingSystemsPanel";
import { TenantDeploymentIntelligencePanel } from "@/src/components/onboarding-os/TenantDeploymentIntelligencePanel";
import { TenantGoLiveReadinessPanel } from "@/src/components/onboarding-os/TenantGoLiveReadinessPanel";
import {
  loadTenantConfigurationOverview,
  resolveConfigurationPreviewContext,
  resolveEffectiveBranding,
} from "@/src/lib/fi/foundation/tenantSettings";
import { parseConfigurationTab } from "@/src/lib/fi/configurationTabs";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { canViewTenantExternalConnectors } from "@/src/lib/onboarding-os/externalConnector.server";
import { canViewTenantDeploymentIntelligence } from "@/src/lib/onboarding-os/deploymentIntelligence.server";
import { canViewGuidedAssistUsageSummary } from "@/src/lib/onboarding-os/guidedAssist.server";
import { canViewTenantGoLiveReadiness } from "@/src/lib/onboarding-os/goLiveReadiness.server";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";
import { getCalendarSettingsAccess } from "@/src/lib/calendar/calendarSettingsAccess.server";
import { loadCalendarSettingsSectionData } from "@/src/lib/calendar/calendarSettings.server";

export const dynamic = "force-dynamic";

function configurationCalendarScopeHref(
  tenantId: string,
  searchParams: { organisationId?: string; clinicId?: string },
  clinicId: string | null
): string {
  const params = new URLSearchParams();
  params.set("tab", "calendar");
  if (searchParams.organisationId?.trim()) {
    params.set("organisationId", searchParams.organisationId.trim());
  }
  if (clinicId?.trim()) {
    params.set("clinicId", clinicId.trim());
  } else if (searchParams.clinicId?.trim()) {
    params.delete("clinicId");
  }
  return `/fi-admin/${tenantId.trim()}/configuration?${params.toString()}`;
}

export default async function TenantConfigurationPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ organisationId?: string; clinicId?: string; tab?: string }>;
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
  const { data: tenant, error: te } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();
  if (te || !tenant) notFound();

  const sp = await searchParams;
  const activeTab = parseConfigurationTab(sp.tab);

  const organisationId =
    typeof sp.organisationId === "string" && sp.organisationId.trim()
      ? sp.organisationId.trim()
      : null;
  const clinicId =
    typeof sp.clinicId === "string" && sp.clinicId.trim() ? sp.clinicId.trim() : null;

  const calendarAccess = await getCalendarSettingsAccess(tenantId);
  if (activeTab === "calendar" && !calendarAccess.canView) {
    notFound();
  }

  const overview = await loadTenantConfigurationOverview(tenantId);
  const previewCtx = resolveConfigurationPreviewContext(overview, organisationId, clinicId);
  const effective = await resolveEffectiveBranding({
    tenantId,
    organisationId: previewCtx.organisationId,
    clinicId: previewCtx.clinicId,
  });

  const calendarSection =
    activeTab === "calendar"
      ? await loadCalendarSettingsSectionData(tenantId, clinicId, calendarAccess)
      : null;

  const showCascadePreview = Boolean(previewCtx.organisationId || previewCtx.clinicId);
  const showGuidedAssistUsage = await canViewGuidedAssistUsageSummary(tenantId);
  const showGoLiveReadiness = await canViewTenantGoLiveReadiness(tenantId);
  const showDeploymentIntelligence = await canViewTenantDeploymentIntelligence(tenantId);
  const showExternalConnectors = await canViewTenantExternalConnectors(tenantId);

  return (
    <div className="space-y-4">
      {showCascadePreview && activeTab === "branding" ? (
        <FiTenantBrandFrame effective={effective} variant="page-preview" />
      ) : null}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">
          Configuration
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          {activeTab === "calendar"
            ? "Configure operational calendar display — visible hours, slot size, default view, and booking visibility."
            : "Tenant-scoped branding and operational defaults. Everyone can review values; saves use the deployment "}
          {activeTab === "branding" ? (
            <>
              <code className="rounded bg-[#141C33] px-1.5 py-0.5 text-xs text-[#22C1FF]">
                FI_ADMIN_API_KEY
              </code>{" "}
              in the operator panel below. See design doc 15 (
              <span className="font-mono text-[#CBD5E1]">15-configuration-admin-editing.md</span>)
              for fields and access control.
            </>
          ) : null}
        </p>
      </div>

      <Suspense fallback={null}>
        <ConfigurationTabNav tenantId={tenantId} activeTab={activeTab} />
      </Suspense>

      {activeTab === "calendar" && calendarSection ? (
        <CalendarSettingsSection
          tenantId={tenantId}
          clinicId={calendarSection.clinicId}
          clinics={calendarSection.clinics}
          initialSettings={calendarSection.initialSettings}
          canEdit={calendarSection.canEdit}
          scopeHrefForClinicId={(nextClinicId) =>
            configurationCalendarScopeHref(tenantId, sp, nextClinicId)
          }
        />
      ) : (
        <>
          {showDeploymentIntelligence ? (
            <TenantDeploymentIntelligencePanel tenantId={tenantId} />
          ) : null}
          {showGoLiveReadiness ? <TenantGoLiveReadinessPanel tenantId={tenantId} /> : null}
          {showExternalConnectors ? (
            <TenantConnectExistingSystemsPanel tenantId={tenantId} />
          ) : null}
          {showGuidedAssistUsage ? <GuidedAssistUsagePanel tenantId={tenantId} /> : null}
          <TenantConfigurationPanel
            tenantId={tenantId}
            overview={overview}
            effective={effective}
            previewOrganisationId={previewCtx.organisationId}
            previewClinicId={previewCtx.clinicId}
            previewFromUrl={Boolean(organisationId || clinicId)}
          />
        </>
      )}
    </div>
  );
}
