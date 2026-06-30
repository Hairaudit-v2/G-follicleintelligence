/**
 * LeadFlowOS — metadata merged into fi_external_events.payload_json._leadflow.
 * Avoids schema migrations for processing/failure visibility.
 */

export const LEADFLOW_EVENT_META_KEY = "_leadflow";

export type LeadFlowExternalEventMeta = {
  processing_started_at?: string;
  processing_error?: string;
  failed_at?: string;
  failed_from_status?: string;
};

export function readLeadFlowEventMeta(
  payload: Record<string, unknown> | null | undefined
): LeadFlowExternalEventMeta {
  const raw = payload?.[LEADFLOW_EVENT_META_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as LeadFlowExternalEventMeta;
}

export function mergeLeadFlowEventMeta(
  payload: Record<string, unknown>,
  patch: LeadFlowExternalEventMeta
): Record<string, unknown> {
  const existing = readLeadFlowEventMeta(payload);
  return {
    ...payload,
    [LEADFLOW_EVENT_META_KEY]: { ...existing, ...patch },
  };
}
