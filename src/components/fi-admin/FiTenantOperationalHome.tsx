import type { FiDashboardWidgetKey } from "@/src/config/fiDashboardRegistry";
import { FiOsControlCentreHome } from "@/src/components/fi-os/FiOsControlCentreHome";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import type { ResolvedDashboardQuickAction } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export function FiTenantOperationalHome(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  showBookingsBoard?: boolean;
  featureAccess?: ReadonlyMap<FiFeatureKey, boolean> | null;
  homeWidgetOrder?: readonly FiDashboardWidgetKey[];
  quickActionItems?: readonly ResolvedDashboardQuickAction[];
}) {
  const { data, showCrmNav, showBookingsBoard = showCrmNav, featureAccess, homeWidgetOrder, quickActionItems } = props;
  return (
    <FiOsControlCentreHome
      data={data}
      showCrmNav={showCrmNav}
      showBookingsBoard={showBookingsBoard}
      featureAccess={featureAccess ?? null}
      homeWidgetOrder={homeWidgetOrder}
      quickActionItems={quickActionItems}
    />
  );
}
