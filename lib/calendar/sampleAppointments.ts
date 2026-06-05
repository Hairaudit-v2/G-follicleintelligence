/**
 * Sample CRM calendar appointments for local / demo testing.
 * Covers consults, PRP sessions, transplants, and follow-ups.
 */

import { utcCalendarDateStringFromDate } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";

export const SAMPLE_BOOKING_ID_PREFIX = "sample-";

export function isSampleBookingId(id: string): boolean {
  return id.startsWith(SAMPLE_BOOKING_ID_PREFIX);
}

function utcMidnightMs(ymd: string): number {
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7)) - 1;
  const d = Number(ymd.slice(8, 10));
  return Date.UTC(y, mo, d, 0, 0, 0, 0);
}

function isoAtUtcDayHour(ymd: string, hour: number, minute = 0): string {
  return new Date(utcMidnightMs(ymd) + (hour * 60 + minute) * 60_000).toISOString();
}

function baseRow(
  tenantId: string,
  partial: Pick<FiBookingRow, "id" | "booking_type" | "booking_status" | "title" | "start_at" | "end_at"> &
    Partial<
      Pick<
        FiBookingRow,
        | "location"
        | "assigned_staff_id"
        | "assigned_user_id"
        | "clinic_id"
        | "metadata"
        | "description"
        | "timezone"
      >
    >
): FiBookingRow {
  const now = new Date().toISOString();
  return {
    id: partial.id,
    tenant_id: tenantId,
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: partial.clinic_id ?? null,
    assigned_staff_id: partial.assigned_staff_id ?? null,
    assigned_user_id: partial.assigned_user_id ?? null,
    booking_type: partial.booking_type,
    booking_status: partial.booking_status,
    title: partial.title,
    description: partial.description ?? null,
    start_at: partial.start_at,
    end_at: partial.end_at,
    timezone: partial.timezone ?? "Australia/Perth",
    location: partial.location ?? "Evolved Perth — South Perth",
    metadata: partial.metadata ?? {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: now,
    updated_at: now,
  };
}

/** Monday UTC of the week containing `dateAnchor`. */
function weekMondayYmd(dateAnchor: string): string {
  const ms = utcMidnightMs(dateAnchor);
  const dow = new Date(ms).getUTCDay();
  const offset = (dow + 6) % 7;
  return utcCalendarDateStringFromDate(new Date(ms - offset * 86_400_000));
}

function addDays(ymd: string, days: number): string {
  return utcCalendarDateStringFromDate(new Date(utcMidnightMs(ymd) + days * 86_400_000));
}

/**
 * Generate a realistic week of sample appointments anchored to `dateAnchor`.
 * IDs are prefixed with {@link SAMPLE_BOOKING_ID_PREFIX} — persisted server updates are skipped.
 */
export function generateSampleCalendarBookings(tenantId: string, dateAnchor: string): FiBookingRow[] {
  const mon = weekMondayYmd(dateAnchor);
  const tue = addDays(mon, 1);
  const wed = addDays(mon, 2);
  const thu = addDays(mon, 3);
  const fri = addDays(mon, 4);

  return [
    baseRow(tenantId, {
      id: `${SAMPLE_BOOKING_ID_PREFIX}consult-1`,
      booking_type: "consultation",
      booking_status: "confirmed",
      title: "James Mitchell — Pre-Surgery Consult",
      start_at: isoAtUtcDayHour(mon, 9, 0),
      end_at: isoAtUtcDayHour(mon, 9, 30),
      location: "Evolved Perth — Consult Room 1",
      metadata: { display_name: "James Mitchell", procedure_label: "Pre-Surgery Consult" },
    }),
    baseRow(tenantId, {
      id: `${SAMPLE_BOOKING_ID_PREFIX}prp-1`,
      booking_type: "prp",
      booking_status: "confirmed",
      title: "Sarah Chen — PRP Session 3",
      start_at: isoAtUtcDayHour(tue, 10, 30),
      end_at: isoAtUtcDayHour(tue, 11, 30),
      location: "Evolved Perth — Treatment Suite A",
      metadata: { display_name: "Sarah Chen", procedure_label: "PRP Session" },
    }),
    baseRow(tenantId, {
      id: `${SAMPLE_BOOKING_ID_PREFIX}transplant-1`,
      booking_type: "surgery",
      booking_status: "arrived",
      title: "David Okonkwo — FUE Transplant Day 1",
      start_at: isoAtUtcDayHour(wed, 8, 0),
      end_at: isoAtUtcDayHour(wed, 14, 0),
      location: "Evolved Perth — Theatre 2",
      metadata: { display_name: "David Okonkwo", procedure_label: "Full Transplant" },
    }),
    baseRow(tenantId, {
      id: `${SAMPLE_BOOKING_ID_PREFIX}followup-1`,
      booking_type: "follow_up",
      booking_status: "confirmed",
      title: "Emma Walsh — Nurse PRP Review",
      start_at: isoAtUtcDayHour(thu, 14, 0),
      end_at: isoAtUtcDayHour(thu, 14, 30),
      location: "Evolved Perth — Suite 3",
      metadata: { display_name: "Emma Walsh", procedure_label: "Follow-up / Nurse PRP" },
    }),
    baseRow(tenantId, {
      id: `${SAMPLE_BOOKING_ID_PREFIX}consult-2`,
      booking_type: "consultation",
      booking_status: "scheduled",
      title: "Michael Torres — Virtual Consult",
      start_at: isoAtUtcDayHour(fri, 11, 0),
      end_at: isoAtUtcDayHour(fri, 11, 45),
      location: "Zoom",
      metadata: {
        display_name: "Michael Torres",
        is_virtual: true,
        procedure_label: "Virtual Consult",
      },
    }),
    baseRow(tenantId, {
      id: `${SAMPLE_BOOKING_ID_PREFIX}prp-2`,
      booking_type: "prp",
      booking_status: "confirmed",
      title: "Lisa Nguyen — PRP Session 1",
      start_at: isoAtUtcDayHour(fri, 15, 0),
      end_at: isoAtUtcDayHour(fri, 16, 0),
      location: "Evolved Perth — Treatment Suite B",
      metadata: { display_name: "Lisa Nguyen", procedure_label: "PRP Session" },
    }),
    baseRow(tenantId, {
      id: `${SAMPLE_BOOKING_ID_PREFIX}waitlist-1`,
      booking_type: "consultation",
      booking_status: "scheduled",
      title: "Alex Rivera — Waitlist Consult",
      start_at: isoAtUtcDayHour(mon, 9, 0),
      end_at: isoAtUtcDayHour(mon, 9, 30),
      metadata: {
        display_name: "Alex Rivera",
        waitlist: true,
        waitlist_notes: "Prefers afternoon slots",
      },
    }),
  ];
}

export function sampleBookingDisplayMap(bookings: FiBookingRow[]): Record<string, OperationalCalendarBookingDisplay> {
  const out: Record<string, OperationalCalendarBookingDisplay> = {};
  for (const b of bookings) {
    if (!isSampleBookingId(b.id)) continue;
    const startMs = Date.parse(b.start_at);
    const endMs = Date.parse(b.end_at);
    const durationMin =
      Number.isFinite(startMs) && Number.isFinite(endMs)
        ? Math.max(1, Math.round((endMs - startMs) / 60_000))
        : 30;
    const meta = b.metadata ?? {};
    const anchorLabel =
      (typeof meta.display_name === "string" && meta.display_name.trim()) ||
      b.title?.trim() ||
      "Patient";
    out[b.id] = {
      anchorLabel,
      scalesSummary: null,
      durationMin,
      reminderHint: null,
    };
  }
  return out;
}

/** Merge server bookings with sample rows (samples replace same-id if any). */
export function mergeBookingsWithSamples(
  serverBookings: FiBookingRow[],
  tenantId: string,
  dateAnchor: string
): FiBookingRow[] {
  const samples = generateSampleCalendarBookings(tenantId, dateAnchor);
  const sampleIds = new Set(samples.map((b) => b.id));
  const filtered = serverBookings.filter((b) => !sampleIds.has(b.id));
  return [...filtered, ...samples].sort((a, b) => a.start_at.localeCompare(b.start_at));
}

export function mergeDisplayWithSamples(
  serverDisplay: Record<string, OperationalCalendarBookingDisplay>,
  sampleBookings: FiBookingRow[]
): Record<string, OperationalCalendarBookingDisplay> {
  return { ...serverDisplay, ...sampleBookingDisplayMap(sampleBookings) };
}
