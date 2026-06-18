import type { ReceptionOsSeverity } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionTaskSourceType, ReceptionTaskStatus } from "@/src/lib/receptionOs/receptionTaskPolicy";

export type ReceptionTaskRow = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  source_type: ReceptionTaskSourceType;
  severity: ReceptionOsSeverity;
  status: ReceptionTaskStatus;
  owner_fi_user_id: string | null;
  due_at: string | null;
  patient_id: string | null;
  case_id: string | null;
  lead_id: string | null;
  booking_id: string | null;
  payment_id: string | null;
  consultation_id: string | null;
  source_alert_kind: string | null;
  source_ref_id: string | null;
  resolution_notes: string | null;
  internal_notes: string | null;
  snoozed_until: string | null;
  metadata: Record<string, unknown>;
  created_by_fi_user_id: string | null;
  resolved_by_fi_user_id: string | null;
  dismissed_by_fi_user_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  dismissed_at: string | null;
};

export type ReceptionTaskAuditRow = {
  id: string;
  tenant_id: string;
  reception_task_id: string;
  event_kind: string;
  actor_fi_user_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};
