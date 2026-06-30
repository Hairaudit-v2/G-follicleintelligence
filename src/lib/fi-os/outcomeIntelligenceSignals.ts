import {
  FI_OUTCOME_CHECKPOINT_KEYS,
  type FiOutcomeCheckpointKey,
  fiOutcomeCheckpointOrderIndex,
  isFiOutcomeCheckpointKey,
  isFiOutcomeMetricKey,
} from "@/src/config/fiOutcomeIntelligenceRegistry";

export type FiOutcomeConfidenceLevel = "unknown" | "low" | "medium" | "high";

/**
 * Normalises a metric value to a JSON-serialisable primitive or small object.
 * Does not interpret clinical meaning beyond type coercion.
 */
export function normalizeOutcomeMetricValue(raw: unknown): string | number | boolean | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    const lower = t.toLowerCase();
    if (lower === "true" || lower === "yes") return true;
    if (lower === "false" || lower === "no") return false;
    const n = Number(t);
    if (!Number.isNaN(n) && String(n) === t) return n;
    return t;
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    return raw;
  }
  return null;
}

/** Normalises metric_values object keys to known metric keys when possible; drops unknown keys optionally. */
export function normalizeOutcomeMetricValues(
  raw: unknown,
  opts?: { dropUnknownKeys?: boolean }
): Record<string, string | number | boolean | null> {
  const dropUnknown = opts?.dropUnknownKeys ?? true;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim();
    if (!key) continue;
    if (dropUnknown && !isFiOutcomeMetricKey(key)) continue;
    out[key] = normalizeOutcomeMetricValue(v);
  }
  return out;
}

export function mergeCheckpointKeys(
  a: readonly string[],
  b: readonly string[]
): FiOutcomeCheckpointKey[] {
  const set = new Set<string>();
  for (const x of a) {
    const t = String(x ?? "").trim();
    if (isFiOutcomeCheckpointKey(t)) set.add(t);
  }
  for (const x of b) {
    const t = String(x ?? "").trim();
    if (isFiOutcomeCheckpointKey(t)) set.add(t);
  }
  return Array.from(set).sort(
    (x, y) => fiOutcomeCheckpointOrderIndex(x) - fiOutcomeCheckpointOrderIndex(y)
  ) as FiOutcomeCheckpointKey[];
}

export function missingOutcomeCheckpoints(captured: readonly string[]): FiOutcomeCheckpointKey[] {
  const cap = new Set(captured.map((c) => String(c).trim()).filter(isFiOutcomeCheckpointKey));
  return FI_OUTCOME_CHECKPOINT_KEYS.filter((k) => !cap.has(k));
}

export function checkpointCompletenessRatio(captured: readonly string[]): {
  captured: number;
  total: number;
  ratio: number;
} {
  const cap = new Set(captured.map((c) => String(c).trim()).filter(isFiOutcomeCheckpointKey));
  const total: number = FI_OUTCOME_CHECKPOINT_KEYS.length;
  return { captured: cap.size, total, ratio: total === 0 ? 0 : cap.size / total };
}

/**
 * Conservative confidence from explicit source linkage and value density — not clinical judgement.
 */
export function deriveOutcomeConfidenceLevel(input: {
  sourceTable: string | null | undefined;
  sourceId: string | null | undefined;
  metricValues: Record<string, unknown>;
}): FiOutcomeConfidenceLevel {
  const hasSource = Boolean(
    String(input.sourceTable ?? "").trim() && String(input.sourceId ?? "").trim()
  );
  const keys = Object.keys(input.metricValues ?? {}).filter(
    (k) => input.metricValues[k] !== null && input.metricValues[k] !== undefined
  );
  const nonEmpty = keys.filter((k) => {
    const v = input.metricValues[k];
    if (typeof v === "string") return v.trim().length > 0;
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v === "boolean") return true;
    return v != null;
  });
  if (!hasSource && nonEmpty.length === 0) return "unknown";
  if (hasSource && nonEmpty.length >= 2) return "high";
  if (hasSource && nonEmpty.length === 1) return "medium";
  if (hasSource || nonEmpty.length >= 2) return "medium";
  if (nonEmpty.length === 1) return "low";
  return "unknown";
}

export function neutralMissingOutcomeCopy(hasAnySignals: boolean): string {
  if (hasAnySignals) return "Some outcome checkpoints have not been captured yet.";
  return "Outcome checkpoints are not recorded yet for this context.";
}
