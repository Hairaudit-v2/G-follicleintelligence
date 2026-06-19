import "server-only";

import { loadCalendarBookings, loadCalendarResources } from "@/src/lib/bookings/calendarLoader";
import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import { clinicOsGridPlacementForBooking } from "@/src/lib/fiAdmin/clinicOsCalendarGrid";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import type { ClinicOsCalendarColumnId, ClinicOsCalendarLiveBookingDTO, ClinicOsCalendarReadOnlyPayload } from "./clinicOsCalendarTypes";
import { anchorLabelForBookingRow } from "@/src/lib/bookings/bookingDisplayContext";
import { loadBookingDisplayContextMaps } from "@/src/lib/bookings/bookingDisplayContext.server";

function todayClinicDayQuery(now: Date, calendarTimezone: string): ParsedCalendarQuery {
  return {
    view: "day",
    dateAnchor: calendarDateStringFromInstant(now, calendarTimezone),
    calendarTimezone,
    status: null,
    bookingType: null,
    assignedUserId: null,
    staffId: null,
    clinicId: null,
    roomId: null,
    resourceView: "staff",
    includeCancelled: false,
    search: null,
    sampleMode: false,
    staffRoleBucket: null,
    waitingOnly: false,
    unassignedOnly: false,
  };
}

function assigneeLabel(options: CrmShellUserPickerOption[], id: string | null): string | null {
  if (!id?.trim()) return null;
  const o = options.find((x) => x.id === id);
  const label = o?.email?.trim() || null;
  return label;
}

function roomLabel(clinics: CrmShellClinicOption[], row: FiBookingRow): string | null {
  if (row.clinic_id?.trim()) {
    const c = clinics.find((x) => x.id === row.clinic_id);
    if (c) return c.display_name;
    return row.clinic_id.slice(0, 8);
  }
  const loc = row.location?.trim();
  return loc || null;
}

function humanizeBookingType(type: string): string {
  const t = type.trim();
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapBookingToGridColumn(row: FiBookingRow): ClinicOsCalendarColumnId {
  const t = row.booking_type.trim().toLowerCase();
  if (t === "surgery") return "surgeryRoom";
  if (t === "prp" || t === "prf" || t === "mesotherapy" || t === "exosomes") return "nursePrp";
  if (t === "consultation") return "consultant";
  return "doctor";
}

/**
 * Read-only bookings for the Clinic OS calendar day view: today's clinic-local window via
 * {@link loadCalendarBookings} / {@link loadBookingsForCalendarOverlap} — no mutations.
 */
export async function loadClinicOsCalendarTodayReadOnly(
  tenantId: string,
  now: Date = new Date()
): Promise<ClinicOsCalendarReadOnlyPayload> {
  const tid = tenantId.trim();
  const { calendarTimezone, gridConfig } = await loadTenantOperationalCalendarSettings(tid);
  const query = todayClinicDayQuery(now, calendarTimezone);
  const dayStartHour = gridConfig.dayStartHourUtc;
  const dayEndHour = gridConfig.dayEndHourUtc;

  const [{ bookings, listTruncated }, resources] = await Promise.all([
    loadCalendarBookings(tid, query),
    loadCalendarResources(tid),
  ]);

  const displayMaps = await loadBookingDisplayContextMaps(tid, bookings);

  const liveBookings: ClinicOsCalendarLiveBookingDTO[] = [];

  for (const row of bookings) {
    const placement = clinicOsGridPlacementForBooking(
      row.start_at,
      row.end_at,
      query.dateAnchor,
      dayStartHour,
      dayEndHour,
      calendarTimezone
    );
    if (!placement) continue;

    liveBookings.push({
      id: row.id,
      title: row.title?.trim() || humanizeBookingType(row.booking_type),
      patientName: anchorLabelForBookingRow(row, displayMaps),
      appointmentType: humanizeBookingType(row.booking_type),
      startTime: row.start_at,
      endTime: row.end_at,
      staffName: assigneeLabel(resources.assignees, row.assigned_user_id),
      roomName: roomLabel(resources.clinics, row),
      status: row.booking_status?.trim() || null,
      href: null,
      startMin: placement.startMin,
      durationMin: placement.durationMin,
      column: mapBookingToGridColumn(row),
    });
  }

  return {
    tenantId: tid,
    calendarTimezone,
    dayYmd: query.dateAnchor,
    dayStartHour,
    dayEndHour,
    liveBookings,
    listTruncated,
  };
}