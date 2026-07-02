import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { getWorkspaceProfileLabel } from "@/src/config/fiWorkspaceProfiles";
import { ComingUpSection } from "@/src/components/fi-os/today/ComingUpSection";
import { RightNowSection } from "@/src/components/fi-os/today/RightNowSection";
import { TodayFeedRefreshMount } from "@/src/components/fi-os/today/TodayFeedRefreshMount";
import { TodayHeader } from "@/src/components/fi-os/today/TodayHeader";
import { UpNextSection } from "@/src/components/fi-os/today/UpNextSection";
import {
  buildTodayFeed,
  countOverdueTasks,
  countPatientsBookedToday,
  firstNameFromDisplayName,
} from "@/src/lib/fiOs/todayFeedDerive";
import { groupTodayFeedItems } from "@/src/lib/fiOs/todayFeedGroup";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

/**
 * FI-UX-REBUILD-1D / P0C — Today surface.
 *
 * Replaces `FiOsControlCentreHome` for opted-in tenants. Living operational feed —
 * not a dashboard. Sidebar is hidden at the shell level when this surface is active.
 */
export function FiOsTodaySurface(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  workspaceProfile?: FiWorkspaceProfileKey;
  viewerDisplayName?: string | null;
}) {
  const { data, showCrmNav, workspaceProfile, viewerDisplayName } = props;

  const now = new Date();
  const dateLine = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: data.operationalDay.calendarTimezone?.trim() || undefined,
  }).format(now);

  const hourOfDay = Number(
    new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      hour12: false,
      timeZone: data.operationalDay.calendarTimezone?.trim() || undefined,
    }).format(now)
  );

  const feed = buildTodayFeed({
    base: `/fi-admin/${data.tenantId}`,
    dashboard: data,
    showCrmNav,
    profileKey: workspaceProfile,
    now,
  });

  const rightNow = groupTodayFeedItems(feed.rightNow);
  const upNext = groupTodayFeedItems(feed.upNext);

  const showWorkspaceBadge = Boolean(workspaceProfile && workspaceProfile !== "default");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-8 sm:space-y-10">
      <TodayFeedRefreshMount />
      <TodayHeader
        tenantName={data.tenantName}
        dateLine={dateLine}
        viewerFirstName={firstNameFromDisplayName(viewerDisplayName)}
        rightNowCount={rightNow.length}
        patientsBooked={countPatientsBookedToday(data.clinicToday)}
        surgeriesScheduled={data.clinicToday.surgeries}
        tasksOverdue={countOverdueTasks(data.tasksDue, now.getTime())}
        workspaceBadge={showWorkspaceBadge ? getWorkspaceProfileLabel(workspaceProfile!) : null}
        hourOfDay={hourOfDay}
      />
      <RightNowSection items={rightNow} />
      <UpNextSection items={upNext} />
      <ComingUpSection items={feed.comingUp} />
    </div>
  );
}
