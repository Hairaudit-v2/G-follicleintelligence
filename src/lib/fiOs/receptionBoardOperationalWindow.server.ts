import "server-only";

import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { computeOperationalLocalDayUtcWindow } from "@/src/lib/fiOs/tenantOperationalLocalDay";

/** Same operational-day UTC window as the tenant operational dashboard / reception board loaders. */
export async function loadReceptionOperationalDayWindow(
  tenantId: string,
  now: Date = new Date()
): Promise<{ localStartIso: string; localEndIso: string; calendarTimezone: string }> {
  const tid = tenantId.trim();
  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const tz = calendarTimezone.trim();
  const { localStartIso, localEndIso } = computeOperationalLocalDayUtcWindow(now, tz);
  return { localStartIso, localEndIso, calendarTimezone: tz };
}
