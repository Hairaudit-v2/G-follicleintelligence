import type { PhotoProtocolAlert } from "./protocolAlerts";
import type {
  HliPhotoProtocolAlertEventStatus,
  HliPhotoProtocolSession,
} from "./types";

const KEY_VERSION = "v1";

/** Statuses that must be preserved across detection refresh upserts. */
export const PHOTO_PROTOCOL_ALERT_PERSISTED_WORKFLOW_STATUSES: ReadonlySet<HliPhotoProtocolAlertEventStatus> = new Set([
  "acknowledged",
  "resolved",
  "dismissed",
]);

export type PhotoProtocolAlertIdempotencyParts = {
  source_system: PhotoProtocolAlert["source_system"];
  tenant_id: string | null;
  protocol_session_id: string;
  alert_type: PhotoProtocolAlert["type"];
  patient_id: string | null;
  case_id: string | null;
  source_record_id: string | null;
};

/**
 * Deterministic idempotency key for alert persistence (stable across runs for the same logical condition).
 */
export function buildPhotoProtocolAlertIdempotencyKey(parts: PhotoProtocolAlertIdempotencyParts): string {
  const tenantSeg = parts.tenant_id?.trim() || "global";
  const pat = parts.patient_id?.trim() || "-";
  const cas = parts.case_id?.trim() || "-";
  const src = parts.source_record_id?.trim() || "-";
  return [
    KEY_VERSION,
    parts.source_system,
    `tenant:${tenantSeg}`,
    `session:${parts.protocol_session_id.trim()}`,
    `type:${parts.alert_type}`,
    `patient:${pat}`,
    `case:${cas}`,
    `src:${src}`,
  ].join("|");
}

export type PhotoProtocolAlertUpsertCandidate = {
  source_system: string;
  source_record_id: string | null;
  tenant_id: string | null;
  clinic_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  protocol_session_id: string;
  alert_type: string;
  severity: string;
  status: HliPhotoProtocolAlertEventStatus;
  message: string;
  recommended_action: string | null;
  payload: Record<string, unknown>;
  idempotency_key: string;
  first_detected_at: string;
  last_detected_at: string;
  acknowledged_at?: string | null;
  acknowledged_by_user_id?: string | null;
  resolved_at?: string | null;
  resolved_by_user_id?: string | null;
};

export function mapComputedAlertToUpsertCandidate(
  alert: PhotoProtocolAlert,
  session: HliPhotoProtocolSession,
  clinicId: string | null,
  runDetectedAtIso: string
): PhotoProtocolAlertUpsertCandidate {
  const idempotency_key = buildPhotoProtocolAlertIdempotencyKey({
    source_system: alert.source_system,
    tenant_id: session.tenant_id,
    protocol_session_id: alert.session_id,
    alert_type: alert.type,
    patient_id: alert.patient_id,
    case_id: alert.case_id,
    source_record_id: session.source_record_id,
  });

  const payload: Record<string, unknown> = {
    clinical_context: alert.clinical_context,
    computed_detected_at: alert.detected_at,
    session_status: session.status,
  };

  return {
    source_system: alert.source_system,
    source_record_id: session.source_record_id,
    tenant_id: session.tenant_id,
    clinic_id: clinicId,
    patient_id: alert.patient_id,
    case_id: alert.case_id,
    protocol_session_id: alert.session_id,
    alert_type: alert.type,
    severity: alert.severity,
    status: "open",
    message: alert.message,
    recommended_action: alert.recommended_action,
    payload,
    idempotency_key,
    first_detected_at: runDetectedAtIso,
    last_detected_at: runDetectedAtIso,
  };
}

export type ExistingAlertEventRow = {
  status: HliPhotoProtocolAlertEventStatus;
  first_detected_at: string;
  last_detected_at: string;
  acknowledged_at: string | null;
  acknowledged_by_user_id: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
};

/**
 * Merge a freshly computed candidate with an existing DB row so upserts do not clear workflow state.
 */
export function mergePhotoProtocolAlertUpsertCandidate(
  candidate: PhotoProtocolAlertUpsertCandidate,
  existing: (ExistingAlertEventRow & { idempotency_key?: string }) | undefined,
  runDetectedAtIso: string
): PhotoProtocolAlertUpsertCandidate {
  if (!existing) {
    return { ...candidate, last_detected_at: runDetectedAtIso };
  }

  const preserveStatus = PHOTO_PROTOCOL_ALERT_PERSISTED_WORKFLOW_STATUSES.has(existing.status);
  const status: HliPhotoProtocolAlertEventStatus = preserveStatus ? existing.status : candidate.status;

  return {
    ...candidate,
    status,
    first_detected_at: existing.first_detected_at,
    last_detected_at: runDetectedAtIso,
    /** Always carry forward workflow columns so PostgREST upsert does not null them out. */
    acknowledged_at: existing.acknowledged_at,
    acknowledged_by_user_id: existing.acknowledged_by_user_id,
    resolved_at: existing.resolved_at,
    resolved_by_user_id: existing.resolved_by_user_id,
  };
}

export function assertPhotoProtocolAlertStatusTransition(
  from: HliPhotoProtocolAlertEventStatus,
  to: HliPhotoProtocolAlertEventStatus
): void {
  if (from === to) return;

  if (to === "acknowledged") {
    if (from !== "open") throw new Error(`Cannot acknowledge from status "${from}".`);
    return;
  }
  if (to === "resolved") {
    if (from !== "open" && from !== "acknowledged") throw new Error(`Cannot resolve from status "${from}".`);
    return;
  }
  if (to === "dismissed") {
    return;
  }
  if (to === "open") {
    throw new Error('Reopening to "open" is not supported via this API.');
  }
  throw new Error(`Unsupported status transition to "${to}".`);
}
