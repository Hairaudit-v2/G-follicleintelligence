/**
 * CalendarOS V2 — intelligent booking card view model (pure).
 */

import type { FiBookingRow } from "@/src/lib/bookings/types";
import { bookingTypeLabel, bookingStatusLabel } from "@/src/lib/bookings/operatorBookingLabels";
import {
  bookingDurationMinutesUtc,
  formatTimeRangeInTimezone,
} from "@/src/lib/calendar/calendarTimezone";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import type { CalendarBookingIntelligence } from "@/src/lib/calendarIntelligence/calendarIntelligenceTypes";
import type { ClinicalStaffingSummaryDto } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";
import {
  deriveCalendarOsBookingWarnings,
  deriveCalendarOsSurgeryIntelligence,
  type CalendarOsBookingWarning,
  type CalendarOsSurgeryIntelligence,
} from "@/src/lib/calendar-os/calendarOperationalWarnings";

export type CalendarOsBookingCardModel = {
  bookingId: string;
  patientName: string;
  bookingType: string;
  bookingTypeLabel: string;
  timeRangeLabel: string;
  durationMin: number;
  assignedDoctor: string | null;
  assignedNurse: string | null;
  roomLabel: string | null;
  statusLabel: string;
  status: string;
  warnings: CalendarOsBookingWarning[];
  surgery: CalendarOsSurgeryIntelligence | null;
  catalogColor: string | null;
  catalogName: string | null;
  teamLine: string | null;
  isUnassigned: boolean;
  riskStatus: CalendarBookingIntelligence["riskStatus"] | null;
};

export type CalendarOsBookingCardInput = {
  booking: FiBookingRow;
  display: OperationalCalendarBookingDisplay | undefined;
  calendarTimezone: string;
  patientName?: string;
};

function patientNameForBooking(
  booking: FiBookingRow,
  display: OperationalCalendarBookingDisplay | undefined,
  override?: string
): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const anchor = display?.anchorLabel?.trim();
  if (anchor) return anchor;
  const title = booking.title?.trim();
  if (title) return title;
  return "Patient";
}

function teamMembersFromStaffing(
  staffing: ClinicalStaffingSummaryDto | null | undefined
): { doctor: string | null; nurse: string | null } {
  if (!staffing) return { doctor: null, nurse: null };
  const missing = staffing.missingRoles.map((m) => m.role).join(", ");
  const doctor =
    staffing.warnings.find((w) => /surgeon|doctor|consultant/i.test(w)) ??
    (staffing.ready ? null : missing || null);
  const nurse =
    staffing.missingRoles.find((m) => /nurse|assistant/i.test(m.role))?.role ?? null;
  return { doctor: doctor ?? null, nurse };
}

export function buildCalendarOsBookingCardModel(
  input: CalendarOsBookingCardInput
): CalendarOsBookingCardModel {
  const { booking, display, calendarTimezone, patientName } = input;
  const operational = display?.operational ?? null;
  const staffing = display?.clinicalStaffing ?? null;
  const durationMin =
    display?.durationMin ??
    bookingDurationMinutesUtc(booking.start_at, booking.end_at) ??
    30;
  const timeRangeLabel = formatTimeRangeInTimezone(
    booking.start_at,
    booking.end_at,
    calendarTimezone
  );
  const teamFromLine = display?.resourceTeamLine?.trim() || null;
  const teamFromStaffing = teamMembersFromStaffing(staffing);
  const warnings = deriveCalendarOsBookingWarnings({
    booking,
    display,
    operational,
    staffing,
  });
  const surgery = operational?.isSurgery
    ? deriveCalendarOsSurgeryIntelligence({
        booking,
        display,
        operational,
        staffing,
        calendarTimezone,
      })
    : null;

  const isUnassigned =
    !booking.assigned_staff_id?.trim() &&
    !booking.assigned_user_id?.trim() &&
    warnings.some((w) => w.kind === "unassigned");

  return {
    bookingId: booking.id,
    patientName: patientNameForBooking(booking, display, patientName),
    bookingType: booking.booking_type,
    bookingTypeLabel:
      display?.procedureCatalogName?.trim() ||
      bookingTypeLabel(booking.booking_type) ||
      booking.booking_type,
    timeRangeLabel,
    durationMin,
    assignedDoctor: teamFromLine ?? teamFromStaffing.doctor ?? display?.resourceTeamLine ?? null,
    assignedNurse: teamFromStaffing.nurse,
    roomLabel: display?.roomLabel ?? display?.resourceRoomLine ?? booking.location ?? null,
    statusLabel: bookingStatusLabel(booking.booking_status),
    status: booking.booking_status,
    warnings,
    surgery,
    catalogColor: display?.procedureCatalogHex ?? null,
    catalogName: display?.procedureCatalogName ?? null,
    teamLine: teamFromLine,
    isUnassigned,
    riskStatus: operational?.riskStatus ?? null,
  };
}

export function buildCalendarOsBookingCardModels(
  bookings: FiBookingRow[],
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>,
  calendarTimezone: string
): Record<string, CalendarOsBookingCardModel> {
  const out: Record<string, CalendarOsBookingCardModel> = {};
  for (const booking of bookings) {
    out[booking.id] = buildCalendarOsBookingCardModel({
      booking,
      display: bookingDisplay[booking.id],
      calendarTimezone,
    });
  }
  return out;
}
