import type { IntelligenceEventName, IntelligenceSystemSource } from "../events/types";

/** Append-only record for bus or adapter logging (forward-looking). */
export type IntelligenceEventLogRecord = {
  id: string;
  receivedAt: string;
  source: IntelligenceSystemSource;
  event_name: IntelligenceEventName;
  correlation_id?: string;
  processing_status: "received" | "processed" | "ignored" | "error";
  error_message?: string;
};

export type IntelligenceExportAttempt = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  target: "fi_os" | "hairaudit" | "iiohr" | "external_archive";
  exportKind: "competency" | "audit" | "graph_snapshot" | "replay_bundle";
  status: "started" | "succeeded" | "failed" | "aborted";
  recordCount?: number;
  error_message?: string;
};

export type IntelligenceReplayRunSummary = {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  source: "fi_events" | "export_bundle" | "fixture";
  eventsProcessed: number;
  eventsSkippedDuplicate: number;
  errors: number;
};

export type IntelligenceIntegrationHealthStatus = {
  integrationKey: string;
  checkedAt: string;
  ok: boolean;
  detail?: string;
  lastSuccessAt?: string;
};
