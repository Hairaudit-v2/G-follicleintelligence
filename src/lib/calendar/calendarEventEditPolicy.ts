/**
 * FI-CALENDAR-WRITEBACK-1A — edit permissions + drawer actions by classification.
 */

import type { CalendarAppointmentCapabilitySet } from "@/src/lib/calendar/calendarAppointmentCapabilities";
import { calendarCapabilitySatisfies } from "@/src/lib/calendar/calendarAppointmentCapabilities";
import {
  calendarEventBlockedReason,
  classifyBookingRow,
  type CalendarEventClassification,
} from "@/src/lib/calendar/calendarEventClassification";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { isBookingCancelled } from "@/src/lib/bookings";

export type CalendarDrawerActionId =
  | "quick_edit"
  | "open_full_appointment"
  | "open_in_google_calendar"
  | "link_patient"
  | "convert_to_fios_appointment"
  | "save"
  | "cancel"
  | "read_only_explanation";

export type CalendarEventEditPolicy = {
  classification: CalendarEventClassification;
  /** Direct field edits in FiOS (Quick Edit / full form). */
  canQuickEdit: boolean;
  /** Drag / resize time and resource columns. */
  canDrag: boolean;
  /** Persist approved changes and write back to Google. */
  canGoogleWriteback: boolean;
  /** Show External / Google badges and distinct chrome. */
  showExternalBadge: boolean;
  /** Grab cursor + drag handle. */
  showGrabCursor: boolean;
  /** Patient linkage required before clinical completion actions. */
  requiresPatientLinkForClinical: boolean;
  /** Production drawer never points staff at a test panel. */
  drawerActions: CalendarDrawerActionId[];
  /** Human explanation when editing is unavailable. */
  readOnlyExplanation: string | null;
  /** Sync status chip for linked Google events. */
  showSyncStatus: boolean;
};

function terminalBooking(row: Pick<FiBookingRow, "booking_status" | "cancelled_at">): boolean {
  return isBookingCancelled(row) || row.booking_status === "completed";
}

export function resolveCalendarEventEditPolicy(
  classification: CalendarEventClassification,
  caps: CalendarAppointmentCapabilitySet,
  opts?: {
    hasPatientLink?: boolean;
    isTerminal?: boolean;
    googleWritebackReady?: boolean;
    googleHtmlLink?: string | null;
    fiosAppointmentId?: string | null;
  }
): CalendarEventEditPolicy {
  const hasPatient = Boolean(opts?.hasPatientLink);
  const terminal = Boolean(opts?.isTerminal);
  const writebackReady = Boolean(opts?.googleWritebackReady);
  const canEdit = calendarCapabilitySatisfies(caps, "appointment.edit");
  const canReschedule = calendarCapabilitySatisfies(caps, "appointment.reschedule");
  const canWriteback = calendarCapabilitySatisfies(caps, "calendar.google_writeback");
  const canLink = calendarCapabilitySatisfies(caps, "appointment.link_patient");
  const canConvert = calendarCapabilitySatisfies(caps, "appointment.convert_external");

  const base: CalendarEventEditPolicy = {
    classification,
    canQuickEdit: false,
    canDrag: false,
    canGoogleWriteback: false,
    showExternalBadge: false,
    showGrabCursor: false,
    requiresPatientLinkForClinical: false,
    drawerActions: [],
    readOnlyExplanation: null,
    showSyncStatus: false,
  };

  if (classification === "fios_native") {
    const editable = canEdit && !terminal;
    const draggable = canReschedule && !terminal;
    const actions: CalendarDrawerActionId[] = [];
    if (editable) actions.push("quick_edit", "save", "cancel");
    actions.push("open_full_appointment");
    if (!hasPatient && canLink) actions.push("link_patient");
    return {
      ...base,
      canQuickEdit: editable,
      canDrag: draggable,
      showGrabCursor: draggable,
      requiresPatientLinkForClinical: !hasPatient,
      drawerActions: actions,
    };
  }

  if (classification === "google_linked_fios") {
    const writebackOk = writebackReady && canWriteback;
    const editable = canEdit && !terminal && writebackOk;
    const draggable = canReschedule && !terminal && writebackOk;
    const actions: CalendarDrawerActionId[] = [];
    if (editable) actions.push("quick_edit", "save", "cancel");
    if (opts?.fiosAppointmentId) actions.push("open_full_appointment");
    if (opts?.googleHtmlLink) actions.push("open_in_google_calendar");
    if (!hasPatient && canLink) actions.push("link_patient");
    return {
      ...base,
      canQuickEdit: editable,
      canDrag: draggable,
      canGoogleWriteback: writebackOk,
      showGrabCursor: draggable,
      requiresPatientLinkForClinical: !hasPatient,
      showSyncStatus: true,
      drawerActions: actions,
      readOnlyExplanation: editable
        ? null
        : !writebackReady || !canWriteback
          ? "Google write-back is not available for this operator or tenant yet."
          : terminal
            ? "Completed or cancelled appointments are read-only."
            : null,
    };
  }

  if (classification === "google_external_unlinked") {
    const actions: CalendarDrawerActionId[] = [];
    if (opts?.googleHtmlLink) actions.push("open_in_google_calendar");
    if (canLink) actions.push("link_patient");
    if (canConvert) actions.push("convert_to_fios_appointment");
    actions.push("read_only_explanation");
    return {
      ...base,
      showExternalBadge: true,
      requiresPatientLinkForClinical: true,
      showSyncStatus: true,
      drawerActions: actions,
      readOnlyExplanation: calendarEventBlockedReason("google_external_unlinked"),
    };
  }

  if (classification === "calendaros_test") {
    return {
      ...base,
      showExternalBadge: true,
      drawerActions: ["read_only_explanation"],
      readOnlyExplanation:
        "CalendarOS test event — isolated from production clinic workflows. Do not use the admin test panel for live appointment management.",
    };
  }

  // blocked_or_unsupported
  return {
    ...base,
    drawerActions: ["read_only_explanation"],
    readOnlyExplanation: calendarEventBlockedReason("blocked_or_unsupported"),
  };
}

export function resolveBookingEditPolicy(
  row: Pick<
    FiBookingRow,
    "metadata" | "patient_id" | "lead_id" | "booking_status" | "cancelled_at"
  >,
  caps: CalendarAppointmentCapabilitySet,
  opts?: {
    googleWritebackReady?: boolean;
    googleHtmlLink?: string | null;
    fiosAppointmentId?: string | null;
  }
): CalendarEventEditPolicy {
  const classification =
    (typeof row.metadata?.calendar_event_classification === "string"
      ? (row.metadata.calendar_event_classification as CalendarEventClassification)
      : null) ?? classifyBookingRow(row);

  return resolveCalendarEventEditPolicy(classification, caps, {
    hasPatientLink: Boolean(row.patient_id?.trim() || row.lead_id?.trim()),
    isTerminal: terminalBooking(row),
    googleWritebackReady: opts?.googleWritebackReady,
    googleHtmlLink: opts?.googleHtmlLink,
    fiosAppointmentId: opts?.fiosAppointmentId ?? null,
  });
}

/** True when the card should show a grab cursor / drag handle. */
export function calendarEventIsDraggable(policy: CalendarEventEditPolicy): boolean {
  return policy.canDrag && policy.showGrabCursor;
}
