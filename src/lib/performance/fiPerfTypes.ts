/** FI OS performance diagnostics — shared types (safe on client + server). */

export type FiPerfSpanRecord = {
  label: string;
  durationMs: number;
  queryCount?: number;
  payloadBytes?: number;
};

export type FiPerfSlowQueryRecord = {
  label: string;
  durationMs: number;
  detail?: string | null;
};

export type FiPerfSnapshot = {
  surface: string;
  tenantId?: string | null;
  totalMs: number;
  spans: FiPerfSpanRecord[];
  slowQueries: FiPerfSlowQueryRecord[];
  queryCount: number;
  payloadBytes: number;
  recordedAt: string;
};

export const FI_PERF_SLOW_QUERY_THRESHOLD_MS = 300;