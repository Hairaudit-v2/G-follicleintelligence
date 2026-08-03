/**
 * FI OS Phase 1 — System Audit Trail types (safe for unit tests; no server-only).
 */

export const SYSTEM_AUDIT_ACTOR_TYPES = ["staff", "patient", "system", "integration"] as const;
export type SystemAuditActorType = (typeof SYSTEM_AUDIT_ACTOR_TYPES)[number];

/** Phase 1 standardised actions. */
export const SYSTEM_AUDIT_ACTIONS = [
  "patient.created",
  "patient.updated",
  "patient.status_changed",
  "note.created",
  "note.updated",
  "payment.recorded",
  "deposit.recorded",
  "lead.approved",
  "lead.rejected",
  "lead.stage_changed",
  "image.uploaded",
  "image.submitted_by_patient",
  "auth.login",
  "auth.login_failed",
  "record.viewed",
  "role.changed",
] as const;

export type SystemAuditAction = (typeof SYSTEM_AUDIT_ACTIONS)[number];

export const SYSTEM_AUDIT_ACTION_SET = new Set<string>(SYSTEM_AUDIT_ACTIONS);

export function isSystemAuditAction(raw: string | null | undefined): raw is SystemAuditAction {
  return SYSTEM_AUDIT_ACTION_SET.has(String(raw ?? "").trim());
}

export type SystemAuditEntityType =
  | "patient"
  | "person"
  | "clinical_note"
  | "payment_record"
  | "lead"
  | "hubspot_staging"
  | "patient_image"
  | "user"
  | "session"
  | "unknown"
  | (string & {});

export type EmitAuditEventInput = {
  tenantId: string;
  action: SystemAuditAction | string;
  entityType: SystemAuditEntityType;
  summary: string;
  entityId?: string | null;
  parentEntityType?: SystemAuditEntityType | null;
  parentEntityId?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Defaults to session auth user when omitted. */
  actorUserId?: string | null;
  actorRole?: string | null;
  actorType?: SystemAuditActorType;
  /** Request-ish context for IP / UA (optional). */
  request?: Request | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  source?: string | null;
  occurredAt?: string | Date | null;
};

export type SystemAuditEventRow = {
  id: string;
  tenant_id: string;
  occurred_at: string;
  actor_user_id: string | null;
  actor_role: string | null;
  actor_type: SystemAuditActorType;
  action: string;
  entity_type: string;
  entity_id: string | null;
  parent_entity_type: string | null;
  parent_entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  source: string;
  created_at: string;
};

export type SystemAuditListFilters = {
  from?: string | null;
  to?: string | null;
  actorUserId?: string | null;
  action?: string | null;
  entityType?: string | null;
  parentEntityType?: string | null;
  parentEntityId?: string | null;
  limit?: number;
};

export const SYSTEM_AUDIT_ACTION_LABELS: Record<SystemAuditAction, string> = {
  "patient.created": "Patient created",
  "patient.updated": "Patient updated",
  "patient.status_changed": "Patient status changed",
  "note.created": "Clinical note created",
  "note.updated": "Clinical note updated",
  "payment.recorded": "Payment recorded",
  "deposit.recorded": "Deposit recorded",
  "lead.approved": "Lead approved",
  "lead.rejected": "Lead rejected",
  "lead.stage_changed": "Lead stage changed",
  "image.uploaded": "Image uploaded",
  "image.submitted_by_patient": "Patient submitted image",
  "auth.login": "Login success",
  "auth.login_failed": "Login failed",
  "record.viewed": "Record viewed",
  "role.changed": "Role changed",
};
