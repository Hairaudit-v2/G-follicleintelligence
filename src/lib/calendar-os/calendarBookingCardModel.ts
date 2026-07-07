/**
 * CalendarOS V2 — intelligent booking card view model (pure).
 */

import type { FiBookingRow } from "@/src/lib/bookings/types";
import { bookingTypeLabel, bookingStatusLabel } from "@/src/lib/bookings/operatorBookingLabels";
import {
  extractPersonNameFromBookingTitle,
  extractServiceLabelFromBookingTitle,
  isLikelyServiceDescriptorTitle,
  UNNAMED_PATIENT_LABEL,
} from "@/src/lib/bookings/bookingDisplayName";
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
import {
  bookingNeedsSourceUpdateWarning,
  externalSourceLabelForBooking,
  isBookingDragMutable,
} from "@/src/lib/calendar-os/calendarOsBookingInteractionCore";

export type CalendarOsBookingCardModel = {
  bookingId: string;
  patientName: string;
  bookingType: string;
  bookingTypeLabel: string;
  timeRangeLabel: string;
  durationMin: number;
  durationLabel: string;
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
  /** Google Calendar / Timely / FI OS source label when known. */
  sourceLabel: string | null;
  /** Imported external rows that cannot be mutated in CalendarOS. */
  readOnlyExternal: boolean;
  /** Drag-and-drop reschedule allowed for this row. */
  dragMutable: boolean;
  /** FI rescheduled locally; source system may still need updating. */
  needsSourceUpdate: boolean;
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

  const fromTitleName = extractPersonNameFromBookingTitle(booking.title);
  const anchor = display?.anchorLabel?.trim();
  const anchorUsable =
    anchor && anchor !== UNNAMED_PATIENT_LABEL && anchor.length > 0;

  if (anchorUsable) return anchor;
  if (fromTitleName) return fromTitleName;

  const title = booking.title?.trim();
  if (title && !isLikelyServiceDescriptorTitle(title)) return title;
  if (title) return title;

  return "Patient";
}

function bookingTypeLabelForCard(
  booking: FiBookingRow,
  display: OperationalCalendarBookingDisplay | undefined
): string {
  const fromCatalog = display?.procedureCatalogName?.trim();
  if (fromCatalog) return fromCatalog;

  const fromEventType = display?.calendarOsEventTypeLabel?.trim();
  if (fromEventType) return fromEventType;

  const fromTitle = extractServiceLabelFromBookingTitle(booking.title);
  if (fromTitle) return fromTitle;

  return bookingTypeLabel(booking.booking_type) || booking.booking_type;
}

function formatDurationLabel(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1h" : `${hours}h`;
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
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

  const sourceLabel = externalSourceLabelForBooking(booking, display);
  const readOnlyExternal = !isBookingDragMutable(booking) && Boolean(sourceLabel);

  return {
    bookingId: booking.id,
    patientName: patientNameForBooking(booking, display, patientName),
    bookingType: booking.booking_type,
    bookingTypeLabel: bookingTypeLabelForCard(booking, display),
    timeRangeLabel,
    durationMin,
    durationLabel: formatDurationLabel(durationMin),
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
    sourceLabel,
    readOnlyExternal,
    dragMutable: isBookingDragMutable(booking),
    needsSourceUpdate: bookingNeedsSourceUpdateWarning(booking),
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
