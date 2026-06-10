import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import type { AgendaBucket } from "@/src/lib/fiOs/tenantOperationalDashboardHelpers";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

const BUCKETS: AgendaBucket[] = ["consult", "surgery", "follow_up", "other"];

/**
 * Distinct CRM leads with at least one agenda booking starting on the tenant operational calendar day.
 * Uses the same agenda payload as the FI OS home dashboard (no extra queries).
 */
export function countDistinctLeadBookingsOnOperationalDay(
  agendaByBucket: TenantOperationalDashboard["agendaByBucket"],
  todayYmd: string,
  fallbackTz: string
): number {
  const seen = new Set<string>();
  for (const bucket of BUCKETS) {
    for (const row of agendaByBucket[bucket]) {
      if (!row.lead_id) continue;
      const tz = row.timezone?.trim() || fallbackTz;
      const ymd = calendarDateStringFromInstant(new Date(row.start_at), tz);
      if (ymd === todayYmd) seen.add(row.lead_id);
    }
  }
  return seen.size;
}

/** Agenda booking counts for the operational day, by FI OS agenda bucket. */
export function countAgendaBookingsOnOperationalDayByBucket(
  agendaByBucket: TenantOperationalDashboard["agendaByBucket"],
  todayYmd: string,
  fallbackTz: string
): Record<AgendaBucket, number> {
  const out: Record<AgendaBucket, number> = { consult: 0, surgery: 0, follow_up: 0, other: 0 };
  for (const bucket of BUCKETS) {
    for (const row of agendaByBucket[bucket]) {
      const tz = row.timezone?.trim() || fallbackTz;
      const ymd = calendarDateStringFromInstant(new Date(row.start_at), tz);
      if (ymd !== todayYmd) continue;
      out[bucket] += 1;
    }
  }
  return out;
}
