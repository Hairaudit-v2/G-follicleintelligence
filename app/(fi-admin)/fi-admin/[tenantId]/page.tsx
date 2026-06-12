import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { FiTenantOperationalHome } from "@/src/components/fi-admin/FiTenantOperationalHome";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { CalendarToastProvider } from "@/components/calendar/CalendarToast";
import { FI_DASHBOARD_HOME_WIDGET_ORDER, FI_DASHBOARD_WIDGET_KEYS } from "@/src/config/fiDashboardRegistry";
import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadFiOsFeatureAccessMapOrNullForViewer } from "@/src/lib/fi-os/featureAccess.server";
import {
  fiDashboardWidgetVisibleByFeatureAccess,
  filterResolvedQuickActionsByFeatureAccess,
} from "@/src/lib/fi-os/stage2FeatureVisibility";
import { loadTenantClinicalIntelligenceSummary } from "@/src/lib/fi-os/clinicalIntelligence.server";
import { loadTenantOutcomeIntelligenceSummary } from "@/src/lib/fi-os/outcomeIntelligence.server";
import { composeWorkspaceDashboardWidgets } from "@/src/lib/fi-os/workspaceDashboardComposer";
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

export default async function FiAdminTenantHomePage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing. Check deployment configuration.</p>
      </InfoNotice>
    );
  }

  const [showCrmNav, showBookingsBoard, featureAccess, workspaceProfile] = await Promise.all([
    getCrmShellNavAllowed(tenantId),
    getBookingsBoardNavAllowed(tenantId),
    loadFiOsFeatureAccessMapOrNullForViewer(tenantId),
    loadWorkspaceProfileKeyForViewer(tenantId),
  ]);

  const base = `/fi-admin/${tenantId.trim()}`;
  const resolvedQuickBase = resolveDashboardQuickActions(base, { showCrmNav, showBookingsBoard });
  const quickActionItems = filterResolvedQuickActionsByFeatureAccess(
    composeWorkspaceQuickActionsOrder({ workspaceProfile, resolvedItems: resolvedQuickBase }),
    featureAccess
  );
  const homeWidgetOrder = composeWorkspaceDashboardWidgets({
    workspaceProfile,
    featureAccess,
    registryBaselineOrder: FI_DASHBOARD_HOME_WIDGET_ORDER,
    availableWidgets: FI_DASHBOARD_WIDGET_KEYS,
  });

  let data;
  try {
    data = await loadTenantOperationalDashboard(tenantId, { includeReceptionBoard: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    throw e;
  }

  const shouldLoadClinical =
    homeWidgetOrder.includes("clinical_intelligence_summary") &&
    fiDashboardWidgetVisibleByFeatureAccess("clinical_intelligence_summary", featureAccess);

  const shouldLoadOutcome =
    homeWidgetOrder.includes("outcome_intelligence_summary") &&
    fiDashboardWidgetVisibleByFeatureAccess("outcome_intelligence_summary", featureAccess);

  const [clinicalIntelligenceSummary, outcomeIntelligenceSummary] = await Promise.all([
    shouldLoadClinical ? loadTenantClinicalIntelligenceSummary(tenantId.trim(), data.actionCentre) : Promise.resolve(null),
    shouldLoadOutcome ? loadTenantOutcomeIntelligenceSummary(tenantId.trim()) : Promise.resolve(null),
  ]);

  return (
    <CalendarToastProvider>
      <FiTenantOperationalHome
        data={data}
        showCrmNav={showCrmNav}
        showBookingsBoard={showBookingsBoard}
        featureAccess={featureAccess}
        homeWidgetOrder={homeWidgetOrder}
        quickActionItems={quickActionItems}
        workspaceProfile={workspaceProfile}
        clinicalIntelligenceSummary={clinicalIntelligenceSummary}
        outcomeIntelligenceSummary={outcomeIntelligenceSummary}
      />
    </CalendarToastProvider>
  );
}
