export const RECEPTION_COMMUNICATION_DELIVERY_STATUSES = [
  "draft",
  "dry_run",
  "queued",
  "sent",
  "failed",
] as const;

export type ReceptionCommunicationDeliveryStatus = (typeof RECEPTION_COMMUNICATION_DELIVERY_STATUSES)[number];

export type ReceptionCommunicationDeliveryRow = {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  patient_id: string | null;
  crm_communication_id: string | null;
  task_id: string | null;
  channel: "sms" | "email";
  provider: "stub" | "resend" | "twilio";
  external_message_id: string | null;
  delivery_status: ReceptionCommunicationDeliveryStatus;
  error_message: string | null;
  sent_at: string | null;
  template_key: string | null;
  to_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ReceptionCommunicationDeliverySummary = {
  id: string;
  channel: "sms" | "email";
  provider: string;
  deliveryStatus: ReceptionCommunicationDeliveryStatus;
  errorMessage: string | null;
  sentAt: string | null;
  templateKey: string | null;
  toAddress: string | null;
  externalMessageId: string | null;
  leadId: string | null;
  patientId: string | null;
  createdAt: string;
};
