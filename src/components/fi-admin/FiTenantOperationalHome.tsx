import type { FiDashboardWidgetKey } from "@/src/config/fiDashboardRegistry";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { FiOsControlCentreHome } from "@/src/components/fi-os/FiOsControlCentreHome";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import type { ResolvedDashboardQuickAction } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import type { TenantClinicalIntelligenceSummary } from "@/src/lib/fi-os/clinicalIntelligence.server";
import type { TenantOutcomeIntelligenceSummary } from "@/src/lib/fi-os/outcomeIntelligence.server";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export function FiTenantOperationalHome(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  showBookingsBoard?: boolean;
  featureAccess?: ReadonlyMap<FiFeatureKey, boolean> | null;
  homeWidgetOrder?: readonly FiDashboardWidgetKey[];
  quickActionItems?: readonly ResolvedDashboardQuickAction[];
  workspaceProfile?: FiWorkspaceProfileKey;
  clinicalIntelligenceSummary?: TenantClinicalIntelligenceSummary | null;
  outcomeIntelligenceSummary?: TenantOutcomeIntelligenceSummary | null;
}) {
  const {
    data,
    showCrmNav,
    showBookingsBoard = showCrmNav,
    featureAccess,
    homeWidgetOrder,
    quickActionItems,
    workspaceProfile,
    clinicalIntelligenceSummary = null,
    outcomeIntelligenceSummary = null,
  } = props;
  return (
    <FiOsControlCentreHome
      data={data}
      showCrmNav={showCrmNav}
      showBookingsBoard={showBookingsBoard}
      featureAccess={featureAccess ?? null}
      homeWidgetOrder={homeWidgetOrder}
      quickActionItems={quickActionItems}
      workspaceProfile={workspaceProfile}
      clinicalIntelligenceSummary={clinicalIntelligenceSummary}
      outcomeIntelligenceSummary={outcomeIntelligenceSummary}
    />
  );
}
