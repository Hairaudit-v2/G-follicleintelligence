/**
 * FI-CALENDAR-WRITEBACK-1A — explicit calendar event classification.
 *
 * Do not infer editability from `externalEventId` alone. Classification drives
 * drawer actions, drag affordances, and Google write-back eligibility.
 */

import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  CALENDAR_OS_EVENT_META_FLAG,
  isCalendarOsEventRow,
  type FiCalendarEventOverlapRow,
} from "@/src/lib/calendar/calendarOsEventsCore";
import {
  deriveCalendarEventOwnershipSource,
  type CalendarEventOwnershipSource,
} from "@/src/lib/calendar/providers/calendarProviderAdapter";

export const CALENDAR_EVENT_CLASSIFICATIONS = [
  "fios_native",
  "google_linked_fios",
  "google_external_unlinked",
  "calendaros_test",
  "blocked_or_unsupported",
] as const;

export type CalendarEventClassification = (typeof CALENDAR_EVENT_CLASSIFICATIONS)[number];

export const PATIENT_NOT_LINKED_LABEL = "Patient not linked";

export type CalendarEventClassificationInput = {
  /** True when the row is projected from `fi_calendar_events` (CalendarOS mirror). */
  isCalendarOsEvent: boolean;
  metadata?: Record<string, unknown> | null;
  patientId?: string | null;
  leadId?: string | null;
  externalEventId?: string | null;
  /** Optional override when ownership was already derived. */
  ownershipSource?: CalendarEventOwnershipSource;
};

function readMetaSource(metadata: Record<string, unknown> | null | undefined): string {
  return String(metadata?.source ?? "")
    .trim()
    .toLowerCase();
}

function resolveExternalEventId(
  metadata: Record<string, unknown> | null | undefined,
  explicit?: string | null
): string | null {
  const fromExplicit = explicit?.trim() || null;
  if (fromExplicit) return fromExplicit;
  const fromMeta = metadata?.external_event_id;
  return typeof fromMeta === "string" && fromMeta.trim() ? fromMeta.trim() : null;
}

/** Derive ownership for classification without requiring a full FiCalendarEvent row. */
export function ownershipSourceForClassification(
  input: Pick<CalendarEventClassificationInput, "metadata" | "patientId" | "leadId" | "ownershipSource">
): CalendarEventOwnershipSource {
  if (input.ownershipSource) return input.ownershipSource;
  return deriveCalendarEventOwnershipSource({
    metadata: input.metadata ?? {},
    patientId: input.patientId ?? null,
    leadId: input.leadId ?? null,
  });
}

/**
 * Classify a calendar row for operational UI + write-back policy.
 *
 * Priority:
 * 1. Native `fi_bookings` (not CalendarOS) → fios_native
 * 2. Admin test-panel provenance → calendaros_test (isolated)
 * 3. FI-owned + Google external id → google_linked_fios
 * 4. Google/imported external without FI operational ownership signals → google_external_unlinked
 * 5. Everything else → blocked_or_unsupported
 */
export function classifyCalendarEvent(
  input: CalendarEventClassificationInput
): CalendarEventClassification {
  if (!input.isCalendarOsEvent) {
    return "fios_native";
  }

  const metadata = input.metadata ?? {};
  const source = readMetaSource(metadata);

  if (source === "fi_admin_test_panel") {
    return "calendaros_test";
  }

  const externalEventId = resolveExternalEventId(metadata, input.externalEventId);
  const ownership = ownershipSourceForClassification(input);

  // FI-created / patient-linked operational events with a Google id are write-back eligible.
  if (ownership === "fi_system" && externalEventId) {
    return "google_linked_fios";
  }

  // FI-owned mirror without Google id cannot write back — treat as blocked until reconciled.
  if (ownership === "fi_system" && !externalEventId) {
    return "blocked_or_unsupported";
  }

  if (ownership === "google_external" || ownership === "imported_external") {
    return "google_external_unlinked";
  }

  return "blocked_or_unsupported";
}

export function classifyBookingRow(
  row: Pick<FiBookingRow, "metadata" | "patient_id" | "lead_id">
): CalendarEventClassification {
  const meta = row.metadata ?? {};
  return classifyCalendarEvent({
    isCalendarOsEvent: isCalendarOsEventRow(row),
    metadata: meta,
    patientId: row.patient_id,
    leadId: row.lead_id,
    externalEventId:
      typeof meta.external_event_id === "string" ? meta.external_event_id : null,
  });
}

export function classifyFiCalendarEventOverlapRow(
  row: Pick<
    FiCalendarEventOverlapRow,
    "metadata" | "patient_id" | "lead_id" | "external_event_id"
  >
): CalendarEventClassification {
  return classifyCalendarEvent({
    isCalendarOsEvent: true,
    metadata: row.metadata ?? {},
    patientId: row.patient_id,
    leadId: row.lead_id,
    externalEventId: row.external_event_id,
  });
}

export function calendarEventClassificationLabel(
  classification: CalendarEventClassification
): string {
  switch (classification) {
    case "fios_native":
      return "FiOS appointment";
    case "google_linked_fios":
      return "Google-linked FiOS";
    case "google_external_unlinked":
      return "External Google event";
    case "calendaros_test":
      return "CalendarOS test event";
    case "blocked_or_unsupported":
      return "Unsupported event";
    default: {
      const _exhaustive: never = classification;
      return _exhaustive;
    }
  }
}

/** Short blocked reason when classification cannot support routine editing. */
export function calendarEventBlockedReason(
  classification: CalendarEventClassification,
  input?: Pick<CalendarEventClassificationInput, "metadata" | "externalEventId">
): string | null {
  if (classification === "calendaros_test") {
    return "Test events stay isolated from production clinic workflows.";
  }
  if (classification === "google_external_unlinked") {
    return "External Google event — link a patient or convert to a FiOS appointment before clinical editing.";
  }
  if (classification === "blocked_or_unsupported") {
    const externalId = resolveExternalEventId(input?.metadata, input?.externalEventId);
    if (!externalId) {
      return "This CalendarOS row has no Google event id, so write-back cannot run safely.";
    }
    return "Editing is unavailable for this event type.";
  }
  return null;
}

/** Persist classification onto sanitized CalendarOS metadata for the client DTO. */
export function withCalendarEventClassificationMeta(
  metadata: Record<string, unknown>,
  classification: CalendarEventClassification
): Record<string, unknown> {
  return {
    ...metadata,
    [CALENDAR_OS_EVENT_META_FLAG]: true,
    calendar_event_classification: classification,
  };
}

export function readCalendarEventClassificationFromMeta(
  metadata: Record<string, unknown> | null | undefined
): CalendarEventClassification | null {
  const raw = metadata?.calendar_event_classification;
  if (typeof raw !== "string") return null;
  if ((CALENDAR_EVENT_CLASSIFICATIONS as readonly string[]).includes(raw)) {
    return raw as CalendarEventClassification;
  }
  return null;
}
