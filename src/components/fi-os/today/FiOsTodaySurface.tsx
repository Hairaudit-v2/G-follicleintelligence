import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { getWorkspaceProfileLabel } from "@/src/config/fiWorkspaceProfiles";
import { ComingUpSection } from "@/src/components/fi-os/today/ComingUpSection";
import { RightNowSection } from "@/src/components/fi-os/today/RightNowSection";
import { TodayFeedRefreshMount } from "@/src/components/fi-os/today/TodayFeedRefreshMount";
import { TodayHeader } from "@/src/components/fi-os/today/TodayHeader";
import { UpNextSection } from "@/src/components/fi-os/today/UpNextSection";
import { buildTodayFeed } from "@/src/lib/fiOs/todayFeedDerive";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

/**
 * FI-UX-REBUILD-1D — Today surface (D0).
 *
 * Replaces `FiOsControlCentreHome` (Clinic Command Center) for tenants where
 * `isTodaySurfaceEnabledForTenant` is true. No KPI cards, no module tiles —
 * only named human work, bucketed into Right now / Up next / Coming up.
 */
export function FiOsTodaySurface(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  workspaceProfile?: FiWorkspaceProfileKey;
}) {
  const { data, showCrmNav, workspaceProfile } = props;

  const now = new Date();
  const dateLine = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);

  const feed = buildTodayFeed({
    base: `/fi-admin/${data.tenantId}`,
    dashboard: data,
    showCrmNav,
    profileKey: workspaceProfile,
    now,
  });

  const showWorkspaceBadge = Boolean(workspaceProfile && workspaceProfile !== "default");

  return (
    <div className="space-y-6 pb-8 sm:space-y-7">
      <TodayFeedRefreshMount />
      <TodayHeader
        tenantName={data.tenantName}
        dateLine={dateLine}
        workspaceBadge={showWorkspaceBadge ? getWorkspaceProfileLabel(workspaceProfile!) : null}
      />
      <RightNowSection items={feed.rightNow} />
      <UpNextSection items={feed.upNext} />
      <ComingUpSection items={feed.comingUp} />
    </div>
  );
}
