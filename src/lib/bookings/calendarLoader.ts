import "server-only";

import {
  loadCrmShellScopePickerOptions,
  loadCrmShellUserPickerOptions,
} from "@/src/lib/crm/crmShellLoaders";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import {
  calendarRangeIsoForQuery,
  parseCalendarSearchParams,
  type ParsedCalendarQuery,
} from "./calendarQuery";
import { formatCalendarRangeTitle } from "./calendarLabels";
import {
  buildCalendarLanesForView,
  bucketBookingsIntoCalendar,
  type CalendarDayLane,
} from "./calendarView";
import { loadBookingsForCalendarOverlap } from "./bookings";
import { CALENDAR_VIEW_BOOKINGS_LIMIT } from "./operatorBookingConstants";
import type { FiBookingRow } from "./types";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";
import { loadReminderJobsForBookings } from "@/src/lib/reminders/reminderJobs.server";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

export type CalendarResources = {
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
};

export type CalendarViewData = {
  tenantId: string;
  query: ParsedCalendarQuery;
  rangeStartIso: string;
  rangeEndIso: string;
  lanes: CalendarDayLane[];
  bookings: FiBookingRow[];
  /** Day key → bookings for client grid (serialisable). */
  buckets: Record<string, FiBookingRow[]>;
  assignees: CrmShellUserPickerOption[];
  clinicalStaffOptions: ClinicalStaffPickerOption[];
  clinics: CrmShellClinicOption[];
  listTruncated: boolean;
  /** Human-readable range heading for the toolbar (clinic-local when tenant timezone is set). */
  rangeTitle: string;
  /** For booking edit drawer when legacy calendar UI is wired. */
  reminderJobsByBookingId: Record<string, FiReminderJobWithTemplate[]>;
  /** Injected by {@link loadAppointmentsPageData} (replaces placeholder from {@link loadCalendarViewData}). */
  services: FiServiceRow[];
};

export async function loadCalendarResources(
  tenantId: string
): Promise<CalendarResources & { clinicalStaffOptions: ClinicalStaffPickerOption[] }> {
  const tid = tenantId.trim();
  const [assignees, clinicalStaffOptions, scope] = await Promise.all([
    loadCrmShellUserPickerOptions(tid),
    loadClinicalStaffPickerOptions(tid),
    loadCrmShellScopePickerOptions(tid),
  ]);
  return { assignees, clinicalStaffOptions, clinics: scope.clinics };
}

export async function loadCalendarBookings(
  tenantId: string,
  query: ParsedCalendarQuery
): Promise<{
  bookings: FiBookingRow[];
  rangeStartIso: string;
  rangeEndIso: string;
  listTruncated: boolean;
}> {
  const tid = tenantId.trim();
  const { rangeStartIso, rangeEndIso } = calendarRangeIsoForQuery(query);

  const bookings = await loadBookingsForCalendarOverlap({
    tenantId: tid,
    rangeStartIso,
    rangeEndIso,
    status: query.status,
    bookingType: query.bookingType,
    assignedStaffId: query.staffId?.trim() || null,
    assignedUserId: null,
    clinicId: query.clinicId,
    includeCancelled: query.includeCancelled,
  });

  return {
    bookings,
    rangeStartIso,
    rangeEndIso,
    listTruncated: bookings.length >= CALENDAR_VIEW_BOOKINGS_LIMIT,
  };
}

/**
 * Server payload for `/fi-admin/[tenantId]/calendar` (Stage 3C).
 * Loads the visible clinic-local range (day or week) plus picker resources.
 */
export async function loadCalendarViewData(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<CalendarViewData> {
  const tid = tenantId.trim();
  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const query = parseCalendarSearchParams(searchParams, new Date(), { calendarTimezone });
  const lanes = buildCalendarLanesForView(query.view, query.dateAnchor, query.calendarTimezone);

  const [{ bookings, rangeStartIso, rangeEndIso, listTruncated }, resources] = await Promise.all([
    loadCalendarBookings(tid, query),
    loadCalendarResources(tid),
  ]);

  const bucketsMap = bucketBookingsIntoCalendar(bookings, lanes);
  const buckets: Record<string, FiBookingRow[]> = {};
  for (const lane of lanes) {
    buckets[lane.dayKey] = bucketsMap.get(lane.dayKey) ?? [];
  }

  const rangeTitle = formatCalendarRangeTitle(query.view, lanes, query.calendarTimezone);

  const reminderMap = await loadReminderJobsForBookings(
    tid,
    bookings.map((b) => b.id)
  );
  const reminderJobsByBookingId: Record<string, FiReminderJobWithTemplate[]> = {};
  for (const b of bookings) {
    reminderJobsByBookingId[b.id] = reminderMap.get(b.id) ?? [];
  }

  return {
    tenantId: tid,
    query,
    rangeStartIso,
    rangeEndIso,
    lanes,
    bookings,
    buckets,
    assignees: resources.assignees,
    clinicalStaffOptions: resources.clinicalStaffOptions,
    clinics: resources.clinics,
    listTruncated,
    rangeTitle,
    reminderJobsByBookingId,
    services: [] as FiServiceRow[],
  };
}
