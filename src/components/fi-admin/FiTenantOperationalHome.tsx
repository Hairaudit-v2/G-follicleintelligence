import { FiOsControlCentreHome } from "@/src/components/fi-os/FiOsControlCentreHome";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export function FiTenantOperationalHome(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  showBookingsBoard?: boolean;
}) {
  const { data, showCrmNav, showBookingsBoard = showCrmNav } = props;
  return <FiOsControlCentreHome data={data} showCrmNav={showCrmNav} showBookingsBoard={showBookingsBoard} />;
}
