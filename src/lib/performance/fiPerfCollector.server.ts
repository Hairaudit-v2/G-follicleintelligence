import "server-only";

import {
  FI_PERF_SLOW_QUERY_THRESHOLD_MS,
  type FiPerfSlowQueryRecord,
  type FiPerfSnapshot,
  type FiPerfSpanRecord,
} from "./fiPerfTypes";
import { isFiPerfDiagnosticsEnabled } from "./fiPerfEnv";

type ActiveCollector = {
  surface: string;
  tenantId: string | null;
  startedAt: number;
  spans: FiPerfSpanRecord[];
  slowQueries: FiPerfSlowQueryRecord[];
  queryCount: number;
  payloadBytes: number;
};

const activeStack: ActiveCollector[] = [];
let lastFinishedSnapshot: FiPerfSnapshot | null = null;

function currentCollector(): ActiveCollector | null {
  return activeStack.length > 0 ? activeStack[activeStack.length - 1]! : null;
}

export function beginFiPerfCollection(surface: string, tenantId?: string | null): void {
  if (!isFiPerfDiagnosticsEnabled()) return;
  lastFinishedSnapshot = null;
  activeStack.push({
    surface,
    tenantId: tenantId?.trim() || null,
    startedAt: performance.now(),
    spans: [],
    slowQueries: [],
    queryCount: 0,
    payloadBytes: 0,
  });
}

export function recordFiPerfQuery(label: string, durationMs: number, detail?: string | null): void {
  const active = currentCollector();
  if (!active) return;
  const ms = Math.round(durationMs);
  active.queryCount += 1;
  if (ms >= FI_PERF_SLOW_QUERY_THRESHOLD_MS) {
    active.slowQueries.push({ label, durationMs: ms, detail: detail ?? null });
  }
}

export function recordFiPerfSpan(
  label: string,
  durationMs: number,
  extra?: { queryCount?: number; payloadBytes?: number }
): void {
  const active = currentCollector();
  if (!active) return;
  active.spans.push({
    label,
    durationMs: Math.round(durationMs),
    queryCount: extra?.queryCount,
    payloadBytes: extra?.payloadBytes,
  });
}

export function recordFiPerfPayloadBytes(bytes: number): void {
  const active = currentCollector();
  if (!active) return;
  active.payloadBytes += Math.max(0, Math.round(bytes));
}

export async function withFiPerfSpan<T>(
  label: string,
  fn: () => Promise<T>,
  extra?: { payloadBytes?: number }
): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    recordFiPerfSpan(label, performance.now() - t0, extra);
  }
}

export function finishFiPerfCollection(): FiPerfSnapshot | null {
  const active = activeStack.pop();
  if (!active) return null;
  const snap: FiPerfSnapshot = {
    surface: active.surface,
    tenantId: active.tenantId,
    totalMs: Math.round(performance.now() - active.startedAt),
    spans: active.spans,
    slowQueries: active.slowQueries,
    queryCount: active.queryCount,
    payloadBytes: active.payloadBytes,
    recordedAt: new Date().toISOString(),
  };
  lastFinishedSnapshot = snap;
  if (process.env.NODE_ENV !== "production") {
    console.info("[fi-perf]", JSON.stringify(snap));
  }
  return snap;
}

export function peekLastFiPerfSnapshot(): FiPerfSnapshot | null {
  return lastFinishedSnapshot;
}

export function drainFiPerfSnapshot(): FiPerfSnapshot | null {
  return finishFiPerfCollection();
}