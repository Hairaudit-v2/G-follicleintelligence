import "server-only";

import { isCalendarOsV2Enabled } from "@/src/lib/calendar-os/calendarOsFeatureFlag";
import { loadFiOsFeatureAccessMapOrNullForViewer } from "@/src/lib/fi-os/featureAccess.server";

/** Resolve whether CalendarOS V2 should render for this tenant viewer. */
export async function resolveCalendarV2EnabledForViewer(
  tenantId: string,
  searchParams?: Record<string, string | string[] | undefined>
): Promise<boolean> {
  const envEnabled = process.env.FI_CALENDAR_V2 === "1" || process.env.FI_CALENDAR_V2 === "true";
  if (envEnabled) return true;

  const featureAccessMap = await loadFiOsFeatureAccessMapOrNullForViewer(tenantId.trim());
  const featureAccess = featureAccessMap
    ? (Object.fromEntries(featureAccessMap) as Partial<Record<string, boolean>>)
    : null;

  return isCalendarOsV2Enabled({
    featureAccess,
    searchParams,
    envCalendarV2: envEnabled,
  });
}
