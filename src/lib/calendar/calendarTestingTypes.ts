/** ClinicOS calendar UAT dashboard (Stage Calendar 2E). */

import type { ReminderJobStatus } from "@/src/lib/reminders/reminderConstants";

export type CalendarQaStatus = "ready" | "warning" | "failed" | "not_tested";

export type CalendarQaRow = {
  id: string;
  title: string;
  description?: string;
  status: CalendarQaStatus;
  detail?: string;
};

export type CalendarQaSection = {
  id: string;
  title: string;
  description?: string;
  rows: CalendarQaRow[];
};

export type CalendarReminderTemplateChecklistItem = {
  id: string;
  label: string;
  /** DB `trigger_event` values that satisfy this UAT bucket (any match counts). */
  expectedTriggers: string[];
  satisfied: boolean;
  detail: string;
};

export type CalendarReminderJobListItem = {
  id: string;
  scheduled_at: string;
  template_name: string;
  trigger_event: string;
  booking_id: string | null;
  status: ReminderJobStatus;
  error_log: string | null;
};

export type CalendarReminderTestingPayload = {
  liveDeliveryEnabled: boolean;
  liveDeliveryHelp: string;
  testSendConfigured: boolean;
  testSendHelp: string;
  emailChannelConfigured: boolean;
  smsChannelConfigured: boolean;
  /** Human summary of when `syncBookingReminderJobs` runs. */
  bookingEnqueueSummary: string;
  templateChecklist: CalendarReminderTemplateChecklistItem[];
  jobStats: Record<ReminderJobStatus, number>;
  recentFailedJobs: CalendarReminderJobListItem[];
  upcomingJobs: CalendarReminderJobListItem[];
};

export type CalendarTestingPagePayload = {
  tenantId: string;
  sections: CalendarQaSection[];
  reminders: CalendarReminderTestingPayload;
};
