import { calendarDateStringFromInstant, zonedMidnightUtcMs, zonedNextDayUtcMs } from "@/src/lib/calendar/calendarTimezone";

const MS_HOUR = 3_600_000;

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * MS_HOUR);
}

/**
 * Tenant-local operational calendar day as UTC half-open bounds `[localStartIso, localEndIso)`,
 * matching booking “today” windows and `fi_crm_leads.created_at` filters on the dashboard.
 */
export function computeOperationalLocalDayUtcWindow(
  now: Date,
  calendarTimezone: string
): { localStartIso: string; localEndIso: string; todayYmd: string } {
  const dayStart = utcDayStart(now).toISOString();
  const dayEnd = addHours(utcDayStart(now), 24).toISOString();
  const tz = calendarTimezone.trim();
  const todayYmd = calendarDateStringFromInstant(now, tz);
  const localDayStartMs = zonedMidnightUtcMs(todayYmd, tz);
  const localDayEndMs = zonedNextDayUtcMs(todayYmd, tz);
  return {
    localStartIso: localDayStartMs != null ? new Date(localDayStartMs).toISOString() : dayStart,
    localEndIso: localDayEndMs != null ? new Date(localDayEndMs).toISOString() : dayEnd,
    todayYmd,
  };
}
