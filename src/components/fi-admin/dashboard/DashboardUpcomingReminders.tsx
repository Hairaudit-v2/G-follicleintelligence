import type { DashboardReminderItem } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

import { DashboardUpcomingRemindersClient } from "./DashboardUpcomingRemindersClient";

/** Server entry: serializable props only; interactivity lives in {@link DashboardUpcomingRemindersClient}. */
export function DashboardUpcomingReminders(props: {
  tenantId: string;
  items: DashboardReminderItem[];
  viewerFiUserId: string | null;
}) {
  return <DashboardUpcomingRemindersClient {...props} />;
}
