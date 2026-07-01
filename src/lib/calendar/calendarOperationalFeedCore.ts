import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import { calendarRangeIsoForQuery } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  buildCalendarBookingIntelligence,
  detectCalendarOverlapConflicts,
  isOutsideClinicBusinessHours,
  shapeCalendarOperationalFeedItem,
} from "@/src/lib/calendarIntelligence/calendarIntelligenceCore";
import type {
  CalendarBookingIntelligence,
  CalendarOperationalFeedItem,
} from "@/src/lib/calendarIntelligence/calendarIntelligenceTypes";
import {
  CALENDAR_OPERATIONAL_FEED_FORBIDDEN_KEYS,
  CALENDAR_OPERATIONAL_FEED_ITEM_KEYS,
} from "@/src/lib/calendarIntelligence/calendarIntelligenceTypes";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import type { PatientJourneyState } from "@/src/lib/patientJourney/patientJourneyStateCore";

export type CalendarOperationalFeedContext = {
  tenantId: string;
  patientNameByBookingId: Map<string, string>;
  staffNameById: Record<string, string>;
  roomLabelById: Record<string, string>;
  journeyStateByPatientId: Map<string, PatientJourneyState>;
  depositSatisfiedByBookingId: Map<string, boolean>;
  consentSignedByPatientId: Map<string, boolean>;
  preOpCompleteByBookingId: Map<string, boolean>;
  readinessPercentByBookingId: Map<string, number>;
  staffIdToUserId: Map<string, string | null>;
  gridConfig: BusinessGridConfig;
  bufferMinutes: number;
};

export type CalendarOperationalFeedResult = {
  items: CalendarOperationalFeedItem[];
  intelligenceByBookingId: Record<string, CalendarBookingIntelligence>;
  rangeStartIso: string;
  rangeEndIso: string;
};

/** Server-side date window for calendar views (day/week/month with buffer). */
export function calendarOperationalDateWindowForQuery(query: ParsedCalendarQuery): {
  rangeStartIso: string;
  rangeEndIso: string;
} {
  return calendarRangeIsoForQuery(query);
}

export function resolvePatientDisplayNameForBooking(
  booking: FiBookingRow,
  patientNameByBookingId: Map<string, string>
): string {
  const fromMap = patientNameByBookingId.get(booking.id)?.trim();
  if (fromMap) return fromMap;
  const title = booking.title?.trim();
  if (title) return title;
  return "Patient";
}

export function resolveStaffSummaryForBooking(
  booking: FiBookingRow,
  staffNameById: Record<string, string>
): string | null {
  const sid = booking.assigned_staff_id?.trim();
  if (sid && staffNameById[sid]) return staffNameById[sid];
  return null;
}

export function resolveRoomLabelForBooking(
  booking: FiBookingRow,
  roomLabelById: Record<string, string>
): string | null {
  const rid = booking.room_id?.trim();
  if (!rid) return booking.location?.trim() || null;
  return roomLabelById[rid] ?? null;
}

export function buildCalendarOperationalFeedFromBookings(
  bookings: FiBookingRow[],
  ctx: CalendarOperationalFeedContext
): CalendarOperationalFeedResult {
  const conflictsByBooking = new Map<string, ReturnType<typeof detectCalendarOverlapConflicts>>();
  for (const b of bookings) {
    const hourViolations = isOutsideClinicBusinessHours(b.start_at, b.end_at, ctx.gridConfig)
      ? [
          {
            kind: "outside_clinic_hours" as const,
            severity: "warning" as const,
            message: "Outside clinic business hours.",
            conflictingBookingId: null,
          },
        ]
      : [];
    const overlap = detectCalendarOverlapConflicts(b, bookings, {
      ignoreBookingId: b.id,
      bufferMinutes: ctx.bufferMinutes,
      staffIdToUserId: ctx.staffIdToUserId,
    });
    conflictsByBooking.set(b.id, [...hourViolations, ...overlap]);
  }

  const items: CalendarOperationalFeedItem[] = [];
  const intelligenceByBookingId: Record<string, CalendarBookingIntelligence> = {};

  for (const booking of bookings) {
    const pid = booking.patient_id?.trim() || null;
    const intelligenceInput = {
      bookingId: booking.id,
      tenantId: ctx.tenantId,
      bookingType: booking.booking_type,
      bookingStatus: booking.booking_status,
      startAt: booking.start_at,
      endAt: booking.end_at,
      patientId: pid,
      caseId: booking.case_id,
      clinicId: booking.clinic_id,
      roomId: booking.room_id,
      roomRequired: booking.room_required,
      assignedStaffId: booking.assigned_staff_id,
      assignedUserId: booking.assigned_user_id,
      metadata: booking.metadata ?? {},
      preOpChecklistComplete: ctx.preOpCompleteByBookingId.get(booking.id),
      consentSigned: pid ? ctx.consentSignedByPatientId.get(pid) : undefined,
      depositSatisfied: ctx.depositSatisfiedByBookingId.get(booking.id),
      journeyState: pid ? ctx.journeyStateByPatientId.get(pid) : undefined,
      readinessPercent: ctx.readinessPercentByBookingId.get(booking.id),
      staffSummary: resolveStaffSummaryForBooking(booking, ctx.staffNameById),
      roomLabel: resolveRoomLabelForBooking(booking, ctx.roomLabelById),
    };

    const intelligence = buildCalendarBookingIntelligence(
      intelligenceInput,
      conflictsByBooking.get(booking.id) ?? []
    );
    intelligenceByBookingId[booking.id] = intelligence;

    items.push(
      shapeCalendarOperationalFeedItem({
        booking,
        patientDisplayName: resolvePatientDisplayNameForBooking(booking, ctx.patientNameByBookingId),
        staffSummary: intelligenceInput.staffSummary,
        roomLabel: intelligenceInput.roomLabel,
        intelligence,
      })
    );
  }

  return {
    items,
    intelligenceByBookingId,
    rangeStartIso: "",
    rangeEndIso: "",
  };
}

/** Assert feed JSON does not include heavy fields (unit / perf regression). */
export function assertCalendarOperationalFeedPayloadIsLightweight(payload: unknown): void {
  const forbidden = new Set<string>(CALENDAR_OPERATIONAL_FEED_FORBIDDEN_KEYS);
  const walk = (node: unknown, path: string): void => {
    if (node == null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) walk(node[i], `${path}[${i}]`);
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (forbidden.has(k)) {
        throw new Error(`Forbidden calendar feed field "${k}" at ${path}`);
      }
      walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(payload, "");

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (!item || typeof item !== "object") continue;
      for (const k of Object.keys(item as Record<string, unknown>)) {
        if (
          !(CALENDAR_OPERATIONAL_FEED_ITEM_KEYS as readonly string[]).includes(k)
        ) {
          throw new Error(`Unexpected calendar feed item key "${k}"`);
        }
      }
    }
  }
}

export function serializeCalendarOperationalFeedForSizeCheck(
  items: CalendarOperationalFeedItem[]
): string {
  return JSON.stringify(items);
}