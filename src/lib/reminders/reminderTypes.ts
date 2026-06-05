import type { ReminderJobStatus, ReminderTemplateType, ReminderTriggerEvent } from "./reminderConstants";

export type FiReminderTemplateRow = {
  id: string;
  tenant_id: string;
  name: string;
  type: ReminderTemplateType;
  trigger_event: ReminderTriggerEvent;
  subject: string | null;
  body: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FiReminderJobRow = {
  id: string;
  tenant_id: string;
  template_id: string;
  booking_id: string | null;
  person_id: string | null;
  lead_id: string | null;
  scheduled_at: string;
  status: ReminderJobStatus;
  attempt_count: number;
  last_attempt_at: string | null;
  delivered_at: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FiReminderJobWithTemplate = FiReminderJobRow & {
  template_name: string;
  template_type: ReminderTemplateType;
  template_trigger_event: ReminderTriggerEvent;
};
