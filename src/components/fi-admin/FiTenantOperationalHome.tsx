import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { FiOsControlCentreHome } from "@/src/components/fi-os/FiOsControlCentreHome";
import type { ResolvedDashboardQuickAction } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import type { TenantClinicalIntelligenceSummary } from "@/src/lib/fi-os/clinicalIntelligence.server";
import type { TenantOutcomeIntelligenceSummary } from "@/src/lib/fi-os/outcomeIntelligence.server";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export function FiTenantOperationalHome(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  showBookingsBoard?: boolean;
  featureAccess?: ReadonlyMap<FiFeatureKey, boolean> | null;
  quickActionItems?: readonly ResolvedDashboardQuickAction[];
  workspaceProfile?: FiWorkspaceProfileKey;
  clinicalIntelligenceSummary?: TenantClinicalIntelligenceSummary | null;
  outcomeIntelligenceSummary?: TenantOutcomeIntelligenceSummary | null;
  showSystemDiagnostics?: boolean;
}) {
  const {
    data,
    showCrmNav,
    showBookingsBoard = showCrmNav,
    featureAccess,
    quickActionItems,
    workspaceProfile,
    clinicalIntelligenceSummary = null,
    outcomeIntelligenceSummary = null,
    showSystemDiagnostics = false,
  } = props;
  return (
    <FiOsControlCentreHome
      data={data}
      showCrmNav={showCrmNav}
      showBookingsBoard={showBookingsBoard}
      featureAccess={featureAccess ?? null}
      quickActionItems={quickActionItems}
      workspaceProfile={workspaceProfile}
      clinicalIntelligenceSummary={clinicalIntelligenceSummary}
      outcomeIntelligenceSummary={outcomeIntelligenceSummary}
      showSystemDiagnostics={showSystemDiagnostics}
    />
  );
}
