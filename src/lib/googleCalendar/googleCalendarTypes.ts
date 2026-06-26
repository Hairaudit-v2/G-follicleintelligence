/**
 * CalendarOS Phase GC-1 — Google Calendar connector types (safe for core unit tests).
 */

import type { GoogleCalendarApiEvent } from "@/src/lib/onboarding-os/googleCalendarConnectorTypes";

export const FI_CALENDAR_INTEGRATION_STATUSES = [
  "active",
  "disconnected",
  "error",
  "expired",
] as const;
export type FiCalendarIntegrationStatus = (typeof FI_CALENDAR_INTEGRATION_STATUSES)[number];

export const FI_CALENDAR_PROVIDERS = ["google"] as const;
export type FiCalendarProvider = (typeof FI_CALENDAR_PROVIDERS)[number];

export const FI_CALENDAR_SYNC_STATUSES = ["never_synced", "success", "failed"] as const;
export type FiCalendarSyncStatus = (typeof FI_CALENDAR_SYNC_STATUSES)[number];

export const FI_CALENDAR_VALIDATION_STATUSES = ["success", "failed"] as const;
export type FiCalendarValidationStatus = (typeof FI_CALENDAR_VALIDATION_STATUSES)[number];

export type FiCalendarIntegration = {
  id: string;
  tenantId: string;
  provider: FiCalendarProvider;
  googleAccountEmail: string | null;
  calendarId: string;
  tokenExpiresAt: string | null;
  status: FiCalendarIntegrationStatus;
  lastSyncedAt: string | null;
  lastSyncStatus: FiCalendarSyncStatus;
  lastSyncError: string | null;
  syncFailureCount: number;
  lastValidatedAt: string | null;
  lastValidationStatus: FiCalendarValidationStatus | null;
  lastValidationError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FiCalendarEvent = {
  id: string;
  tenantId: string;
  externalEventId: string | null;
  provider: FiCalendarProvider;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  eventType: string | null;
  googleMeetUrl: string | null;
  patientId: string | null;
  leadId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateGoogleCalendarEventInput = {
  tenantId: string;
  calendarId?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: string;
  endTime: string;
  eventType?: string | null;
  addGoogleMeet?: boolean;
  patientId?: string | null;
  leadId?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateGoogleCalendarEventInput = {
  tenantId: string;
  eventId: string;
  title?: string;
  description?: string | null;
  location?: string | null;
  startTime?: string;
  endTime?: string;
  eventType?: string | null;
  metadata?: Record<string, unknown>;
};

export type GoogleCalendarOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export type GoogleCalendarConferenceData = {
  createRequest?: {
    requestId: string;
    conferenceSolutionKey: { type: string };
  };
  entryPoints?: readonly {
    entryPointType?: string;
    uri?: string;
    label?: string;
  }[];
};

export type GoogleCalendarApiEventWithConference = GoogleCalendarApiEvent & {
  hangoutLink?: string;
  conferenceData?: GoogleCalendarConferenceData;
};

export type GoogleCalendarSyncResult = {
  discovered: number;
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
};

/** CalendarOS GC-4 — native FI appointment creation input. */
export type FiAppointmentInput = {
  tenantId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: string;
  endTime: string;
  eventType?: string | null;
  patientId?: string | null;
  leadId?: string | null;
  addGoogleMeet?: boolean;
  attendees?: string[];
  metadata?: Record<string, unknown>;
};

export type NormalizedFiAppointmentInput = {
  tenantId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  eventType: string;
  patientId: string | null;
  leadId: string | null;
  addGoogleMeet: boolean;
  attendees: string[];
  metadata: Record<string, unknown>;
};

/** Sanitized appointment payload returned by GC-4 API (no tokens or raw Google payloads). */
export type SanitizedFiAppointment = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  google_meet_url: string | null;
  external_event_id: string | null;
  calendar_id: string;
};
