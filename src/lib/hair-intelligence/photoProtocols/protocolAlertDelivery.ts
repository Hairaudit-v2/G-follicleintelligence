/**
 * Delivery preparation for persisted photo protocol alerts (Stage 8D).
 *
 * Future path: a scheduled worker or Supabase Edge function would:
 * 1. Select `hli_photo_protocol_alert_events` rows where `shouldDeliverPhotoProtocolAlert` is true and no delivery log exists.
 * 2. Fan out to email/Slack/webhook using `buildPhotoProtocolAlertDeliveryPayload`.
 * 3. Record delivery attempts in a future `hli_photo_protocol_alert_deliveries` table (not created in Stage 8D).
 *
 * Stage 8D intentionally does not send outbound email or Slack.
 */

import {
  fiOsFoundationPhotoProtocolAnalyticsHref,
  fiOsPatientTwinPhotoProtocolHref,
  hairAuditCasePhotoProtocolHrefPlaceholder,
  hairLongevityIntakePhotoProtocolHrefPlaceholder,
} from "./protocolDeepLinks";
import type { HliPhotoProtocolAlertEvent } from "./types";

export type PhotoProtocolAlertDeliveryChannel = "in_app" | "email" | "slack" | "webhook";

export type PhotoProtocolAlertDeliveryPayload = {
  channel: PhotoProtocolAlertDeliveryChannel;
  title: string;
  body: string;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  protocol_session_id: string;
  alert_type: string;
  severity: string;
  status: string;
  idempotency_key: string;
  deep_links: {
    patient_twin_protocol: string | null;
    foundation_analytics: string | null;
    hairaudit_case: string | null;
    hair_longevity_intake: string | null;
  };
  raw_payload: Record<string, unknown>;
};

function titleForEvent(ev: HliPhotoProtocolAlertEvent): string {
  return `[${ev.severity.toUpperCase()}] ${ev.alert_type.replace(/_/g, " ")}`;
}

/**
 * Normalised payload for notification workers (in-app feed, email, Slack, webhooks).
 */
export function buildPhotoProtocolAlertDeliveryPayload(
  ev: HliPhotoProtocolAlertEvent,
  channel: PhotoProtocolAlertDeliveryChannel
): PhotoProtocolAlertDeliveryPayload {
  const tid = ev.tenant_id?.trim() || null;
  const patientTwin =
    tid && ev.patient_id?.trim() ? fiOsPatientTwinPhotoProtocolHref(tid, ev.patient_id.trim()) : null;
  const foundation = tid ? fiOsFoundationPhotoProtocolAnalyticsHref(tid) : null;
  const hairaudit =
    ev.case_id?.trim() && ev.source_system === "hairaudit"
      ? hairAuditCasePhotoProtocolHrefPlaceholder(ev.case_id.trim())
      : ev.source_system === "hairaudit" && ev.source_record_id?.trim()
        ? hairAuditCasePhotoProtocolHrefPlaceholder(ev.source_record_id.trim())
        : null;
  const hlIntake =
    ev.source_system === "hair_longevity" && ev.source_record_id?.trim()
      ? hairLongevityIntakePhotoProtocolHrefPlaceholder(ev.source_record_id.trim())
      : null;

  const bodyParts = [ev.message, ev.recommended_action].filter(Boolean);
  return {
    channel,
    title: titleForEvent(ev),
    body: bodyParts.join("\n\n"),
    tenant_id: tid,
    patient_id: ev.patient_id,
    case_id: ev.case_id,
    protocol_session_id: ev.protocol_session_id,
    alert_type: ev.alert_type,
    severity: ev.severity,
    status: ev.status,
    idempotency_key: ev.idempotency_key,
    deep_links: {
      patient_twin_protocol: patientTwin,
      foundation_analytics: foundation,
      hairaudit_case: hairaudit,
      hair_longevity_intake: hlIntake,
    },
    raw_payload: ev.payload,
  };
}

/**
 * Stub gate for future delivery — today only `in_app` is considered potentially deliverable for **open** alerts.
 */
export function shouldDeliverPhotoProtocolAlert(ev: HliPhotoProtocolAlertEvent, channel: PhotoProtocolAlertDeliveryChannel): boolean {
  if (ev.status !== "open") return false;
  if (channel === "in_app") return true;
  return false;
}
