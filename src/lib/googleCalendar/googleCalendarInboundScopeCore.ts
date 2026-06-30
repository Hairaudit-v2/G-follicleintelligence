/**
 * CalendarOS GC-6B — inbound Google Calendar scope admin UI types and serialization.
 */

import type { FiCalendarSyncStatus } from "./googleCalendarTypes";

export type InboundSyncCalendarClientRow = {
  id: string;
  summary: string | null;
  googleCalendarId: string;
  isEnabled: boolean;
  isPrimary: boolean;
  accessRole: string | null;
  timeZone: string | null;
  lastSyncedAt: string | null;
  updatedAt: string;
};

export type InboundSyncLastResultSummary = {
  status: FiCalendarSyncStatus;
  errorSummary: string | null;
  calendarsScanned: number | null;
  eventsFetched: number | null;
  eventsInserted: number | null;
  eventsUpdated: number | null;
  eventsSkipped: number | null;
  failedCalendarCount: number | null;
};

export type GoogleCalendarInboundScopePageModel = {
  tenantId: string;
  canManage: boolean;
  connected: boolean;
  integrationId: string | null;
  googleAccountEmail: string | null;
  /** Outbound/default calendar used for appointment creation — unchanged in GC-6B. */
  outboundCalendarId: string | null;
  calendars: InboundSyncCalendarClientRow[];
  stats: {
    calendarsDiscovered: number;
    calendarsEnabled: number;
    lastSyncAt: string | null;
    lastSyncResult: InboundSyncLastResultSummary | null;
  };
};

export type GoogleCalendarInboundSyncNowSummary = {
  calendarsScanned: number;
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  reviewItemsCreated?: number;
  reviewItemsUpdated?: number;
  conflictsDetected?: number;
  conflictsByType?: Record<string, number>;
  perCalendar: Array<{
    calendarId: string;
    calendarSummary: string | null;
    fetched: number;
    inserted: number;
    updated: number;
    skipped: number;
    failed: boolean;
    error: string | null;
  }>;
};

type InboundSyncCalendarDbRow = {
  id: string;
  google_calendar_id: string;
  google_calendar_summary: string | null;
  is_enabled: boolean;
  is_primary: boolean;
  last_synced_at: string | null;
  updated_at: string;
  metadata: Record<string, unknown> | null;
};

function readMetadataString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

export function inboundSyncCalendarRowToClient(
  row: InboundSyncCalendarDbRow
): InboundSyncCalendarClientRow {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    summary: row.google_calendar_summary?.trim() ?? null,
    googleCalendarId: row.google_calendar_id.trim(),
    isEnabled: row.is_enabled,
    isPrimary: row.is_primary,
    accessRole: readMetadataString(metadata, "accessRole"),
    timeZone: readMetadataString(metadata, "timeZone"),
    lastSyncedAt: row.last_synced_at,
    updatedAt: row.updated_at,
  };
}

export function buildInboundScopePageStats(
  calendars: InboundSyncCalendarClientRow[],
  integration: {
    lastSyncedAt: string | null;
    lastSyncStatus: FiCalendarSyncStatus;
    lastSyncErrorSummary: string | null;
  } | null
): GoogleCalendarInboundScopePageModel["stats"] {
  const calendarsDiscovered = calendars.length;
  const calendarsEnabled = calendars.filter((c) => c.isEnabled).length;

  const perCalendarLastSync = calendars
    .map((c) => c.lastSyncedAt)
    .filter((v): v is string => Boolean(v?.trim()));
  const maxPerCalendar = perCalendarLastSync.length
    ? perCalendarLastSync.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b))
    : null;

  const lastSyncAt = maxPerCalendar ?? integration?.lastSyncedAt ?? null;

  const lastSyncResult: InboundSyncLastResultSummary | null = integration
    ? {
        status: integration.lastSyncStatus,
        errorSummary: integration.lastSyncErrorSummary,
        calendarsScanned: null,
        eventsFetched: null,
        eventsInserted: null,
        eventsUpdated: null,
        eventsSkipped: null,
        failedCalendarCount: null,
      }
    : null;

  return {
    calendarsDiscovered,
    calendarsEnabled,
    lastSyncAt,
    lastSyncResult,
  };
}
