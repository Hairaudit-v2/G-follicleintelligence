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

export type FiCalendarIntegration = {
  id: string;
  tenantId: string;
  provider: FiCalendarProvider;
  googleAccountEmail: string | null;
  calendarId: string;
  tokenExpiresAt: string | null;
  status: FiCalendarIntegrationStatus;
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
