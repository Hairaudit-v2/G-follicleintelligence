/**
 * OnboardingOS Phase F3 — Google Calendar read-only connector types (safe for core unit tests; no server-only).
 */

export const EXTERNAL_CALENDAR_EVENT_TYPES = [
  "consultation",
  "surgery",
  "prp",
  "exosomes",
  "follow_up",
  "review",
  "unknown",
] as const;
export type ExternalCalendarEventType = (typeof EXTERNAL_CALENDAR_EVENT_TYPES)[number];

export const EXTERNAL_CALENDAR_IMPORT_STATUSES = [
  "staged",
  "reviewed",
  "approved",
  "rejected",
  "imported",
] as const;
export type ExternalCalendarImportStatus = (typeof EXTERNAL_CALENDAR_IMPORT_STATUSES)[number];

export const EXTERNAL_CALENDAR_SYNC_RUN_STATUSES = [
  "started",
  "completed",
  "partial",
  "failed",
] as const;
export type ExternalCalendarSyncRunStatus = (typeof EXTERNAL_CALENDAR_SYNC_RUN_STATUSES)[number];

export const EXTERNAL_CALENDAR_MAPPING_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "linked",
] as const;
export type ExternalCalendarMappingStatus = (typeof EXTERNAL_CALENDAR_MAPPING_STATUSES)[number];

export const EXTERNAL_CALENDAR_IMPORT_AUDIT_ACTIONS = [
  "sync_started",
  "sync_completed",
  "sync_failed",
  "event_staged",
  "event_duplicate",
  "event_approved",
  "event_rejected",
  "event_reviewed",
] as const;
export type ExternalCalendarImportAuditAction =
  (typeof EXTERNAL_CALENDAR_IMPORT_AUDIT_ACTIONS)[number];

export const EXTERNAL_CALENDAR_SYNC_HEALTH_BANDS = [
  "healthy",
  "degraded",
  "unhealthy",
  "unknown",
] as const;
export type ExternalCalendarSyncHealthBand = (typeof EXTERNAL_CALENDAR_SYNC_HEALTH_BANDS)[number];

/** Raw Google Calendar API event shape (subset used for normalization). */
export type GoogleCalendarApiEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: readonly { email?: string; responseStatus?: string }[];
  status?: string;
  htmlLink?: string;
  created?: string;
  updated?: string;
};

export type NormalizedExternalCalendarEvent = {
  googleEventId: string;
  calendarId: string;
  eventTitle: string;
  startAt: string | null;
  endAt: string | null;
  attendeeEmails: readonly string[];
  normalizedEventType: ExternalCalendarEventType;
  rawPayload: Record<string, unknown>;
};

export type ExternalCalendarStagingEvent = {
  id: string;
  integrationId: string;
  tenantId: string;
  syncRunId: string | null;
  googleEventId: string;
  calendarId: string;
  eventTitle: string;
  startAt: string | null;
  endAt: string | null;
  attendeeEmails: readonly string[];
  rawPayload: Record<string, unknown>;
  normalizedEventType: ExternalCalendarEventType;
  importStatus: ExternalCalendarImportStatus;
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExternalCalendarSyncRun = {
  id: string;
  integrationId: string;
  tenantId: string;
  status: ExternalCalendarSyncRunStatus;
  eventsDiscovered: number;
  eventsStaged: number;
  eventsSkipped: number;
  healthScore: number;
  detail: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};

export type ExternalCalendarEventMapping = {
  id: string;
  integrationId: string;
  tenantId: string;
  stagingEventId: string;
  googleEventId: string;
  fiBookingId: string | null;
  mappingStatus: ExternalCalendarMappingStatus;
  detail: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ExternalCalendarImportAuditEntry = {
  id: string;
  integrationId: string;
  tenantId: string;
  stagingEventId: string | null;
  syncRunId: string | null;
  action: ExternalCalendarImportAuditAction;
  actorLabel: string | null;
  detail: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type CalendarSyncPreview = {
  integrationId: string;
  calendarId: string;
  eventsDiscovered: number;
  eventsToStage: number;
  duplicateCount: number;
  sampleEvents: readonly NormalizedExternalCalendarEvent[];
  warnings: readonly string[];
};

export type CalendarSyncHealth = {
  healthScore: number;
  healthBand: ExternalCalendarSyncHealthBand;
  lastSyncAt: string | null;
  lastSyncStatus: ExternalCalendarSyncRunStatus | null;
  stagedPendingReview: number;
  approvedCount: number;
  rejectedCount: number;
  summary: string;
  blockers: readonly string[];
  warnings: readonly string[];
};

export type GoogleCalendarConnectorSnapshot = {
  tenantId: string;
  integrationId: string;
  syncHealth: CalendarSyncHealth;
  latestSyncRun: ExternalCalendarSyncRun | null;
  recentSyncRuns: readonly ExternalCalendarSyncRun[];
  stagingQueue: readonly ExternalCalendarStagingEvent[];
  calculatedAt: string;
};

export const EXTERNAL_CALENDAR_IMPORT_STATUS_BADGES: Record<
  ExternalCalendarImportStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  staged: { label: "Pending review", tone: "info" },
  reviewed: { label: "Reviewed", tone: "neutral" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  imported: { label: "Imported", tone: "success" },
};

export const EXTERNAL_CALENDAR_EVENT_TYPE_LABELS: Record<ExternalCalendarEventType, string> = {
  consultation: "Consultation",
  surgery: "Surgery",
  prp: "PRP",
  exosomes: "Exosomes",
  follow_up: "Follow-up",
  review: "Review",
  unknown: "Unknown",
};

export function isExternalCalendarEventType(value: string): value is ExternalCalendarEventType {
  return (EXTERNAL_CALENDAR_EVENT_TYPES as readonly string[]).includes(value);
}

export function isExternalCalendarImportStatus(
  value: string
): value is ExternalCalendarImportStatus {
  return (EXTERNAL_CALENDAR_IMPORT_STATUSES as readonly string[]).includes(value);
}

export function isExternalCalendarSyncRunStatus(
  value: string
): value is ExternalCalendarSyncRunStatus {
  return (EXTERNAL_CALENDAR_SYNC_RUN_STATUSES as readonly string[]).includes(value);
}
