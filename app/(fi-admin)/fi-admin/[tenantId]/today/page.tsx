import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { CalendarToastProvider } from "@/components/calendar/CalendarToast";
import { FiTenantOperationalHome } from "@/src/components/fi-admin/FiTenantOperationalHome";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { FiOsTodaySurface } from "@/src/components/fi-os/today/FiOsTodaySurface";
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
import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { resolveEffectiveTenantAuthUserIdFromSession } from "@/src/lib/crm/crmGate";
import { resolveFiOsAuthUserDisplayNameForTenant } from "@/src/lib/fiOs/fiOsAuthDisplay.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadTenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { runTodayFeedShadowValidation } from "@/src/lib/fiOs/todayFeedShadowDiff";
import {
  isTodayRealtimeEnabledForTenant,
  isTodaySignalRevisionPollEnabled,
} from "@/src/lib/fiOs/todaySignal/todayRealtimePlan";
import { isTodaySurfaceEnabledForTenant } from "@/src/lib/fiOs/todaySurfaceRollout.server";
import { resolveTodaySurfaceStaffBakeAccess } from "@/src/lib/fiOs/todaySurfaceStaffBakeGate.server";

export const metadata = {
  title: "Today",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * D6G canonical Today surface at `/fi-admin/[tenantId]/today`.
 * Bare tenant home redirects here for all roles.
 */
export default async function FiAdminTodayPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();

  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  const authUserId = await resolveEffectiveTenantAuthUserIdFromSession();

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

  const [
    showCrmNav,
    showBookingsBoard,
    featureAccess,
    workspaceProfile,
    showSystemDiagnostics,
    data,
  ] = await Promise.all([
    getCrmShellNavAllowed(tenantId),
    getBookingsBoardNavAllowed(tenantId),
    loadFiOsFeatureAccessMapOrNullForViewer(tenantId),
    loadWorkspaceProfileKeyForViewer(tenantId),
    canViewDashboardSystemDiagnostics(tenantId),
    loadTenantOperationalDashboard(tenantId, { includeReceptionBoard: true }).catch((e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "Tenant not found") notFound();
      throw e;
    }),
  ]);

  const base = `/fi-admin/${tenantId.trim()}`;
  const resolvedQuickBase = resolveDashboardQuickActions(base, { showCrmNav, showBookingsBoard });
  const quickActionItems = filterResolvedQuickActionsByFeatureAccess(
    composeWorkspaceQuickActionsOrder({ workspaceProfile, resolvedItems: resolvedQuickBase }),
    featureAccess
  );

  runTodayFeedShadowValidation({ dashboard: data, showCrmNav, profileKey: workspaceProfile });

  const todaySurfaceTenantEnabled = isTodaySurfaceEnabledForTenant(tenantId);
  const [todaySurfaceBakeAllowed, viewerDisplayName] = await Promise.all([
    todaySurfaceTenantEnabled
      ? resolveTodaySurfaceStaffBakeAccess(tenantId)
      : Promise.resolve(false),
    authUserId
      ? resolveFiOsAuthUserDisplayNameForTenant(authUserId, tenantId)
      : Promise.resolve(null),
  ]);

  if (todaySurfaceTenantEnabled && todaySurfaceBakeAllowed) {
    return (
      <CalendarToastProvider>
        <FiOsTodaySurface
          data={data}
          showCrmNav={showCrmNav}
          workspaceProfile={workspaceProfile}
          viewerDisplayName={viewerDisplayName}
          todayRealtimeEnabled={isTodayRealtimeEnabledForTenant(tenantId)}
          todayRevisionPollEnabled={isTodaySignalRevisionPollEnabled()}
          showSystemDiagnostics={showSystemDiagnostics}
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
