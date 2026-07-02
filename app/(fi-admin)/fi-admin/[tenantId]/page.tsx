import { unstable_noStore as noStore } from "next/cache";

import { notFound } from "next/navigation";

import { FiTenantOperationalHome } from "@/src/components/fi-admin/FiTenantOperationalHome";

import { FiOsTodaySurface } from "@/src/components/fi-os/today/FiOsTodaySurface";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";

import { isTodaySurfaceEnabledForTenant } from "@/src/lib/fiOs/todaySurfaceRollout.server";

import { runTodayFeedShadowValidation } from "@/src/lib/fiOs/todayFeedShadowDiff";

import { CalendarToastProvider } from "@/components/calendar/CalendarToast";

import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";

import {
  resolveFiOsAuthUserDisplayNameById,
} from "@/src/lib/fiOs/fiOsAuthDisplay.server";

import { canViewDashboardSystemDiagnostics } from "@/src/lib/fi-os/dashboardSystemDiagnosticsAccess.server";

import { loadTenantClinicalIntelligenceSummary } from "@/src/lib/fi-os/clinicalIntelligence.server";

import { loadTenantOutcomeIntelligenceSummary } from "@/src/lib/fi-os/outcomeIntelligence.server";

import { loadFiOsFeatureAccessMapOrNullForViewer } from "@/src/lib/fi-os/featureAccess.server";

import {
  fiDashboardWidgetVisibleByFeatureAccess,
  filterResolvedQuickActionsByFeatureAccess,
} from "@/src/lib/fi-os/stage2FeatureVisibility";

import { composeWorkspaceQuickActionsOrder } from "@/src/lib/fi-os/workspaceQuickActionsComposer";

import { loadWorkspaceProfileKeyForViewer } from "@/src/lib/fi-os/workspaceProfile.server";

import { resolveDashboardQuickActions } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";

import { loadTenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Home",

  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminTenantHomePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();

  const { tenantId } = await params;

  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">
          Supabase environment variables are missing. Check deployment configuration.
        </p>
      </InfoNotice>
    );
  }

  const [showCrmNav, showBookingsBoard, featureAccess, workspaceProfile, showSystemDiagnostics] =
    await Promise.all([
      getCrmShellNavAllowed(tenantId),

      getBookingsBoardNavAllowed(tenantId),

      loadFiOsFeatureAccessMapOrNullForViewer(tenantId),

      loadWorkspaceProfileKeyForViewer(tenantId),

      canViewDashboardSystemDiagnostics(tenantId),
    ]);

  const base = `/fi-admin/${tenantId.trim()}`;

  const resolvedQuickBase = resolveDashboardQuickActions(base, { showCrmNav, showBookingsBoard });

  const quickActionItems = filterResolvedQuickActionsByFeatureAccess(
    composeWorkspaceQuickActionsOrder({ workspaceProfile, resolvedItems: resolvedQuickBase }),

    featureAccess
  );

  let data;

  try {
    data = await loadTenantOperationalDashboard(tenantId, { includeReceptionBoard: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";

    if (msg === "Tenant not found") notFound();

    throw e;
  }

  // P0B shadow mode: always compute + compare (never affects which surface renders below).
  runTodayFeedShadowValidation({ dashboard: data, showCrmNav, profileKey: workspaceProfile });

  // `tenantId` here is always `fi_tenants.id` (a UUID) — this route never receives
  // a slug — so FI_TODAY_SURFACE_TENANT_IDS must be populated with tenant UUIDs.
  // See src/lib/fiOs/todaySurfaceRollout.server.ts for allowlist/slug details.
  if (isTodaySurfaceEnabledForTenant(tenantId)) {
    const authUserId = await resolveAuthUserId(null);
    const viewerDisplayName = authUserId
      ? await resolveFiOsAuthUserDisplayNameById(authUserId)
      : null;

    return (
      <CalendarToastProvider>
        <FiOsTodaySurface
          data={data}
          showCrmNav={showCrmNav}
          workspaceProfile={workspaceProfile}
          viewerDisplayName={viewerDisplayName}
        />
      </CalendarToastProvider>
    );
  }

  const shouldLoadClinical =
    showSystemDiagnostics &&
    fiDashboardWidgetVisibleByFeatureAccess("clinical_intelligence_summary", featureAccess);

  const shouldLoadOutcome =
    showSystemDiagnostics &&
    fiDashboardWidgetVisibleByFeatureAccess("outcome_intelligence_summary", featureAccess);

  const [clinicalIntelligenceSummary, outcomeIntelligenceSummary] = await Promise.all([
    shouldLoadClinical
      ? loadTenantClinicalIntelligenceSummary(tenantId.trim(), data.actionCentre)
      : Promise.resolve(null),

    shouldLoadOutcome
      ? loadTenantOutcomeIntelligenceSummary(tenantId.trim())
      : Promise.resolve(null),
  ]);

  return (
    <CalendarToastProvider>
      <FiTenantOperationalHome
        data={data}
        showCrmNav={showCrmNav}
        showBookingsBoard={showBookingsBoard}
        featureAccess={featureAccess}
        quickActionItems={quickActionItems}
        workspaceProfile={workspaceProfile}
        clinicalIntelligenceSummary={clinicalIntelligenceSummary}
        outcomeIntelligenceSummary={outcomeIntelligenceSummary}
        showSystemDiagnostics={showSystemDiagnostics}
      />
    </CalendarToastProvider>
  );
}
