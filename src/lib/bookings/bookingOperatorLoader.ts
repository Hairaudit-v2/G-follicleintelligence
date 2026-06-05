import "server-only";

import { loadCrmShellScopePickerOptions, loadCrmShellUserPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import {
  addUtcDays,
  parseOperatorBookingSearchParams,
  startOfUtcDayFromDate,
  utcDayBoundsMs,
  type ParsedOperatorBookingQuery,
} from "./operatorBookingQuery";
import { computeOperatorBookingSummaryCounts, type OperatorBookingSummaryCounts } from "./operatorBookingSummary";
import { DEFAULT_OPERATOR_BOOKINGS_LIMIT, MAX_OPERATOR_BOOKINGS_LIMIT } from "./operatorBookingConstants";
import { loadReminderJobsForBookings } from "@/src/lib/reminders/reminderJobs.server";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";
import { loadBookingsForOperatorView } from "./bookings";
import type { FiBookingRow } from "./types";

export type { ParsedOperatorBookingQuery } from "./operatorBookingQuery";

/** How far back to load rows for summary tiles (overlap query). */
export const OPERATOR_SUMMARY_DAYS_BACK = 120;

export type BookingsOperatorPageData = {
  tenantId: string;
  query: ParsedOperatorBookingQuery;
  bookings: FiBookingRow[];
  /** Serialized map: booking id → reminder jobs (pending/sent/failed). */
  reminderJobsByBookingId: Record<string, FiReminderJobWithTemplate[]>;
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  summaryCounts: OperatorBookingSummaryCounts;
  /** True when the summary query hit {@link MAX_OPERATOR_BOOKINGS_LIMIT} rows. */
  summaryTruncated: boolean;
  /** True when the main list hit the default row cap. */
  listTruncated: boolean;
  groupingNowIso: string;
};

function maxIso(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * Server data for `/fi-admin/[tenantId]/bookings` (Stage 3B).
 */
export async function loadBookingsOperatorPageData(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<BookingsOperatorPageData> {
  const tid = tenantId.trim();
  const now = new Date();
  const query = parseOperatorBookingSearchParams(searchParams, now);
  const { dayStartMs, dayEndMs } = utcDayBoundsMs(now);

  const summaryStartIso = addUtcDays(startOfUtcDayFromDate(now), -OPERATOR_SUMMARY_DAYS_BACK).toISOString();
  const tomorrowStartIso = addUtcDays(startOfUtcDayFromDate(now), 1).toISOString();
  const summaryEndIso = maxIso(query.endIso, tomorrowStartIso);

  const bookings = await loadBookingsForOperatorView({
    tenantId: tid,
    rangeStartIso: query.startIso,
    rangeEndIso: query.endIso,
    status: query.status,
    bookingType: query.bookingType,
    assignedUserId: query.assignedUserId,
    clinicId: query.clinicId,
    includeCancelled: query.includeCancelled,
  });

  const [summaryRows, assignees, scope, reminderMap] = await Promise.all([
    loadBookingsForOperatorView({
      tenantId: tid,
      rangeStartIso: summaryStartIso,
      rangeEndIso: summaryEndIso,
      includeCancelled: true,
      limit: MAX_OPERATOR_BOOKINGS_LIMIT,
    }),
    loadCrmShellUserPickerOptions(tid),
    loadCrmShellScopePickerOptions(tid),
    loadReminderJobsForBookings(
      tid,
      bookings.map((b) => b.id)
    ),
  ]);

  const summaryCounts = computeOperatorBookingSummaryCounts(summaryRows, {
    nowMs: now.getTime(),
    dayStartMs,
    dayEndMs,
  });

  const reminderJobsByBookingId: Record<string, FiReminderJobWithTemplate[]> = {};
  for (const [k, v] of Array.from(reminderMap.entries())) {
    reminderJobsByBookingId[k] = v;
  }

  return {
    tenantId: tid,
    query,
    bookings,
    reminderJobsByBookingId,
    assignees,
    clinics: scope.clinics,
    summaryCounts,
    summaryTruncated: summaryRows.length >= MAX_OPERATOR_BOOKINGS_LIMIT,
    listTruncated: bookings.length >= DEFAULT_OPERATOR_BOOKINGS_LIMIT,
    groupingNowIso: now.toISOString(),
  };
}
