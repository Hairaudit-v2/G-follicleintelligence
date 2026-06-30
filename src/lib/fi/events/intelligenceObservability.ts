/**
 * Source-model mapping from FI persistence shapes to `@follicle/intelligence-core`
 * observability types. Read-only — no DB writes or migrations.
 */

import type { FiEventRow, FiEventLogRow } from "@/lib/fi/events/idempotency";
import type { FiSourceSystem } from "@/src/types/fi-events";
import type { IntelligenceEventLogRecord } from "@follicle/intelligence-core";
import { mapFiSourceSystemToIntelligenceSource } from "./intelligenceCoreAdapter";

function mapFiStatusToProcessingStatus(
  status: string
): IntelligenceEventLogRecord["processing_status"] {
  switch (status) {
    case "received":
      return "received";
    case "processed":
      return "processed";
    case "ignored":
      return "ignored";
    case "failed":
      return "error";
    case "processing":
      return "received";
    default:
      return "received";
  }
}

/**
 * Maps a `fi_events` row (as loaded by idempotency helpers) into an `IntelligenceEventLogRecord`.
 * `event_name` is only typed when it matches the intelligence allow-list; unknown names use assertion.
 */
export function fiEventRowToIntelligenceLogRecord(row: FiEventRow): IntelligenceEventLogRecord {
  const warnings: { code: string; message: string }[] = [];
  const source = mapFiSourceSystemToIntelligenceSource(
    row.source_system as FiSourceSystem | string,
    warnings
  );

  return {
    id: row.id,
    receivedAt: row.created_at,
    source,
    event_name: row.event_type as IntelligenceEventLogRecord["event_name"],
    processing_status: mapFiStatusToProcessingStatus(String(row.status)),
    ...(row.error_text ? { error_message: row.error_text } : {}),
  };
}

/**
 * Best-effort merge of log linkage row into a base intelligence log record (same event id).
 */
export function mergeFiEventLogRow(
  base: IntelligenceEventLogRecord,
  log: FiEventLogRow | null | undefined
): IntelligenceEventLogRecord {
  if (!log) return base;
  const err = log.error ?? undefined;
  if (!err) return base;
  return { ...base, error_message: err, processing_status: "error" };
}
