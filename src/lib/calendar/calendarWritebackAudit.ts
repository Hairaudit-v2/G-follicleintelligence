/**
 * FI-CALENDAR-WRITEBACK-1A — calendar mutation audit trail (pure helpers).
 */

import type { CalendarEventClassification } from "@/src/lib/calendar/calendarEventClassification";

export const CALENDAR_INTERACTION_SOURCES = [
  "calendar_drag",
  "calendar_quick_edit",
  "patient_link",
  "external_conversion",
  "google_sync",
] as const;

export type CalendarInteractionSource = (typeof CALENDAR_INTERACTION_SOURCES)[number];

export type CalendarWritebackStatus =
  | "not_required"
  | "pending"
  | "synced"
  | "conflict"
  | "failed";

export type CalendarAuditFieldChange = {
  field: string;
  previous: unknown;
  next: unknown;
};

export type CalendarMutationAuditRecord = {
  id: string;
  tenantId: string;
  recordedAt: string;
  actingUserId: string | null;
  actingUserLabel: string | null;
  interactionSource: CalendarInteractionSource;
  classification: CalendarEventClassification;
  fiosAppointmentId: string | null;
  googleEventId: string | null;
  localCalendarEventId: string | null;
  changes: CalendarAuditFieldChange[];
  writebackStatus: CalendarWritebackStatus;
  conflictDetails: string | null;
  failureDetails: string | null;
  metadata: Record<string, unknown>;
};

export type BuildCalendarMutationAuditInput = {
  id: string;
  tenantId: string;
  recordedAt?: string;
  actingUserId?: string | null;
  actingUserLabel?: string | null;
  interactionSource: CalendarInteractionSource;
  classification: CalendarEventClassification;
  fiosAppointmentId?: string | null;
  googleEventId?: string | null;
  localCalendarEventId?: string | null;
  previousValues: Record<string, unknown>;
  nextValues: Record<string, unknown>;
  writebackStatus: CalendarWritebackStatus;
  conflictDetails?: string | null;
  failureDetails?: string | null;
  metadata?: Record<string, unknown>;
};

/** Diff previous → next into audited field changes (stable key order). */
export function diffCalendarAuditChanges(
  previousValues: Record<string, unknown>,
  nextValues: Record<string, unknown>
): CalendarAuditFieldChange[] {
  const keys = new Set([...Object.keys(previousValues), ...Object.keys(nextValues)]);
  const changes: CalendarAuditFieldChange[] = [];
  for (const field of [...keys].sort()) {
    const previous = previousValues[field];
    const next = nextValues[field];
    if (Object.is(previous, next)) continue;
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    changes.push({ field, previous: previous ?? null, next: next ?? null });
  }
  return changes;
}

export function buildCalendarMutationAuditRecord(
  input: BuildCalendarMutationAuditInput
): CalendarMutationAuditRecord {
  return {
    id: input.id,
    tenantId: input.tenantId.trim(),
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    actingUserId: input.actingUserId?.trim() || null,
    actingUserLabel: input.actingUserLabel?.trim() || null,
    interactionSource: input.interactionSource,
    classification: input.classification,
    fiosAppointmentId: input.fiosAppointmentId?.trim() || null,
    googleEventId: input.googleEventId?.trim() || null,
    localCalendarEventId: input.localCalendarEventId?.trim() || null,
    changes: diffCalendarAuditChanges(input.previousValues, input.nextValues),
    writebackStatus: input.writebackStatus,
    conflictDetails: input.conflictDetails?.trim() || null,
    failureDetails: input.failureDetails?.trim() || null,
    metadata: input.metadata ?? {},
  };
}

/** Append-only activity entry shape stored on `fi_calendar_events.metadata.appointment_activity`. */
export function calendarAuditToActivityEntry(
  record: CalendarMutationAuditRecord
): Record<string, unknown> {
  return {
    type: "calendar_mutation_audit",
    at: record.recordedAt,
    acting_user_id: record.actingUserId,
    acting_user_label: record.actingUserLabel,
    interaction_source: record.interactionSource,
    classification: record.classification,
    fios_appointment_id: record.fiosAppointmentId,
    google_event_id: record.googleEventId,
    local_calendar_event_id: record.localCalendarEventId,
    changes: record.changes,
    writeback_status: record.writebackStatus,
    conflict_details: record.conflictDetails,
    failure_details: record.failureDetails,
    metadata: record.metadata,
  };
}
