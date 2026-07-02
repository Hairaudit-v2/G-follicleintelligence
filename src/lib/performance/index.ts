/** FI OS performance diagnostics — shared exports (client-safe types only). */
export type {
  FiPerfSnapshot,
  FiPerfSpanRecord,
  FiPerfSlowQueryRecord,
} from "./fiPerfTypes";
export { FI_PERF_SLOW_QUERY_THRESHOLD_MS } from "./fiPerfTypes";
export { isFiPerfDiagnosticsEnabled } from "./fiPerfEnv";