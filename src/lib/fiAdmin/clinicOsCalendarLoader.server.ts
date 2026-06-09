import "server-only";

import { loadCalendarBookings, loadCalendarResources } from "@/src/lib/bookings/calendarLoader";
import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import { utcCalendarDateStringFromDate } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { ClinicOsCalendarColumnId, ClinicOsCalendarLiveBookingDTO, ClinicOsCalendarReadOnlyPayload } from "./clinicOsCalendarTypes";
import { anchorLabelForBookingRow } from "@/src/lib/bookings/bookingDisplayContext";
import { loadBookingDisplayContextMaps } from "@/src/lib/bookings/bookingDisplayContext.server";

function todayUtcDayQuery(now: Date): ParsedCalendarQuery {
  return {
    view: "day",
    dateAnchor: utcCalendarDateStringFromDate(now),
    calendarTimezone: "UTC",
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
 * Read-only bookings for the Clinic OS calendar day view: today's UTC window via
 * {@link loadCalendarBookings} / {@link loadBookingsForCalendarOverlap} — no mutations.
 */
export async function loadClinicOsCalendarTodayReadOnly(
  tenantId: string,
  now: Date = new Date()
): Promise<ClinicOsCalendarReadOnlyPayload> {
  const tid = tenantId.trim();
  const query = todayUtcDayQuery(now);

  const [{ bookings, listTruncated }, resources] = await Promise.all([
    loadCalendarBookings(tid, query),
    loadCalendarResources(tid),
  ]);

  const displayMaps = await loadBookingDisplayContextMaps(tid, bookings);

  /** Must match `ClinicOsCalendarHome` grid (8:00–18:00 UTC when live data is shown). */
  const dayStartHourUtc = 8;

  const liveBookings: ClinicOsCalendarLiveBookingDTO[] = [];

  for (const row of bookings) {
    const startMs = Date.parse(row.start_at);
    const endMs = Date.parse(row.end_at);
    const dur = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(1, Math.round((endMs - startMs) / 60000)) : 30;

    const start = new Date(row.start_at);
    const startMin = start.getUTCHours() * 60 + start.getUTCMinutes() - dayStartHourUtc * 60;
    const endMin = startMin + dur;
    const gridLast = 10 * 60;
    if (endMin <= 0 || startMin >= gridLast) continue;

    const visStart = Math.max(0, startMin);
    const visEnd = Math.min(gridLast, endMin);
    const displayDurationMin = Math.max(15, visEnd - visStart);

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
      startMin: visStart,
      durationMin: displayDurationMin,
      column: mapBookingToGridColumn(row),
    });
  }

  return {
    tenantId: tid,
    dayUtcYmd: query.dateAnchor,
    liveBookings,
    listTruncated,
  };
}
