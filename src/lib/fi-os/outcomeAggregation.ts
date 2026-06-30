import {
  FI_OUTCOME_METRIC_KEYS,
  isFiOutcomeMetricKey,
} from "@/src/config/fiOutcomeIntelligenceRegistry";
import { normalizeOutcomeMetricValue } from "@/src/lib/fi-os/outcomeIntelligenceSignals";

export const FI_OUTCOME_ANONYMISATION_MIN_SAMPLE = 25;
export const FI_OUTCOME_ANONYMISATION_MIN_TENANTS = 3;

/** Keys that must never appear in global aggregate JSON payloads. */
export const FI_OUTCOME_FORBIDDEN_IDENTIFIER_KEYS = [
  "patient_id",
  "case_id",
  "staff_id",
  "clinic_id",
  "tenant_id",
  "fi_user_id",
  "auth_user_id",
] as const;

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

export type OutcomeTenantMeasurementInput = {
  metric_values: Record<string, unknown>;
};

export type OutcomeMetricSummary = {
  /** metricKey -> { count, sum?, min?, max?, bool_true?, bool_false? } simplified */
  [metricKey: string]: {
    n: number;
    sum?: number;
    min?: number;
    max?: number;
    trueCount?: number;
    falseCount?: number;
  };
};

function forbiddenKeyInObject(obj: unknown): string | null {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const lower = k.trim().toLowerCase();
    if ((FI_OUTCOME_FORBIDDEN_IDENTIFIER_KEYS as readonly string[]).includes(lower)) return k;
  }
  return null;
}

/** Deep scan for forbidden keys and UUID-like strings in JSON structure. */
export function detectOutcomeIdentifierLeakage(
  payload: unknown
): { ok: true } | { ok: false; reason: string } {
  const walk = (node: unknown, path: string): { ok: false; reason: string } | null => {
    if (node === null || node === undefined) return null;
    if (typeof node === "string") {
      if (UUID_RE.test(node)) return { ok: false, reason: `uuid_like_string_at:${path}` };
      return null;
    }
    if (typeof node === "number" || typeof node === "boolean") return null;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const hit = walk(node[i], `${path}[${i}]`);
        if (hit) return hit;
      }
      return null;
    }
    if (typeof node === "object") {
      const bad = forbiddenKeyInObject(node);
      if (bad) return { ok: false, reason: `forbidden_key:${path}.${bad}` };
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        const hit = walk(v, `${path}.${k}`);
        if (hit) return hit;
      }
    }
    return null;
  };
  const hit = walk(payload, "$");
  if (hit) return hit;
  return { ok: true };
}

export function buildOutcomeCohortKey(parts: {
  periodStart: string;
  periodEnd: string;
  label: string;
}): string {
  const a = parts.periodStart.trim();
  const b = parts.periodEnd.trim();
  const slug = parts.label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return `cohort:${a}:${b}:${slug || "default"}`;
}

export function aggregateOutcomeMetricSummaries(
  rows: readonly OutcomeTenantMeasurementInput[]
): OutcomeMetricSummary {
  const summary: OutcomeMetricSummary = {};
  for (const row of rows) {
    const mv = row.metric_values ?? {};
    for (const mk of FI_OUTCOME_METRIC_KEYS) {
      if (!(mk in mv)) continue;
      const v = normalizeOutcomeMetricValue(mv[mk]);
      if (v === null) continue;
      if (!summary[mk]) summary[mk] = { n: 0 };
      const slot = summary[mk];
      slot.n += 1;
      if (typeof v === "boolean") {
        if (v) slot.trueCount = (slot.trueCount ?? 0) + 1;
        else slot.falseCount = (slot.falseCount ?? 0) + 1;
      } else if (typeof v === "number") {
        slot.sum = (slot.sum ?? 0) + v;
        slot.min = slot.min === undefined ? v : Math.min(slot.min, v);
        slot.max = slot.max === undefined ? v : Math.max(slot.max, v);
      }
    }
    for (const [k, val] of Object.entries(mv)) {
      if (isFiOutcomeMetricKey(k)) continue;
      if (!summary[k]) summary[k] = { n: 0 };
      const slot = summary[k];
      const v = normalizeOutcomeMetricValue(val);
      if (v === null) continue;
      slot.n += 1;
      if (typeof v === "boolean") {
        if (v) slot.trueCount = (slot.trueCount ?? 0) + 1;
        else slot.falseCount = (slot.falseCount ?? 0) + 1;
      } else if (typeof v === "number") {
        slot.sum = (slot.sum ?? 0) + v;
        slot.min = slot.min === undefined ? v : Math.min(slot.min, v);
        slot.max = slot.max === undefined ? v : Math.max(slot.max, v);
      }
    }
  }
  return summary;
}

export type OutcomeAnonymisationGateInput = {
  sampleSize: number;
  contributingTenantCount: number;
  metricSummary: unknown;
  protocolMix: unknown;
};

export function outcomeAnonymisationThresholdsMet(input: OutcomeAnonymisationGateInput): boolean {
  if (input.sampleSize < FI_OUTCOME_ANONYMISATION_MIN_SAMPLE) return false;
  if (input.contributingTenantCount < FI_OUTCOME_ANONYMISATION_MIN_TENANTS) return false;
  const m = detectOutcomeIdentifierLeakage(input.metricSummary);
  if (!m.ok) return false;
  const p = detectOutcomeIdentifierLeakage(input.protocolMix);
  if (!p.ok) return false;
  return true;
}

export function refuseNetworkOutcomeAggregation(
  input: OutcomeAnonymisationGateInput
): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  if (input.sampleSize < FI_OUTCOME_ANONYMISATION_MIN_SAMPLE) {
    reasons.push(`sample_size_lt_${FI_OUTCOME_ANONYMISATION_MIN_SAMPLE}`);
  }
  if (input.contributingTenantCount < FI_OUTCOME_ANONYMISATION_MIN_TENANTS) {
    reasons.push(`contributing_tenants_lt_${FI_OUTCOME_ANONYMISATION_MIN_TENANTS}`);
  }
  const m = detectOutcomeIdentifierLeakage(input.metricSummary);
  if (!m.ok) reasons.push(`metric_summary:${m.reason}`);
  const p = detectOutcomeIdentifierLeakage(input.protocolMix);
  if (!p.ok) reasons.push(`protocol_mix:${p.reason}`);
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

/** Parses a stored JSON metric_summary into typed slots (best-effort). */
export function parseOutcomeMetricSummary(raw: unknown): OutcomeMetricSummary {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: OutcomeMetricSummary = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const slot = v as Record<string, unknown>;
    const n = typeof slot.n === "number" ? slot.n : Number(slot.n);
    if (!Number.isFinite(n) || n < 0) continue;
    const entry: OutcomeMetricSummary[string] = { n };
    if (slot.sum !== undefined) {
      const s = typeof slot.sum === "number" ? slot.sum : Number(slot.sum);
      if (Number.isFinite(s)) entry.sum = s;
    }
    if (slot.min !== undefined) {
      const s = typeof slot.min === "number" ? slot.min : Number(slot.min);
      if (Number.isFinite(s)) entry.min = s;
    }
    if (slot.max !== undefined) {
      const s = typeof slot.max === "number" ? slot.max : Number(slot.max);
      if (Number.isFinite(s)) entry.max = s;
    }
    if (slot.trueCount !== undefined) {
      const s = typeof slot.trueCount === "number" ? slot.trueCount : Number(slot.trueCount);
      if (Number.isFinite(s)) entry.trueCount = s;
    }
    if (slot.falseCount !== undefined) {
      const s = typeof slot.falseCount === "number" ? slot.falseCount : Number(slot.falseCount);
      if (Number.isFinite(s)) entry.falseCount = s;
    }
    out[k] = entry;
  }
  return out;
}

/** Merges per-tenant metric summaries for anonymised network draft rows. */
export function mergeOutcomeMetricSummaries(
  summaries: readonly OutcomeMetricSummary[]
): OutcomeMetricSummary {
  const out: OutcomeMetricSummary = {};
  for (const s of summaries) {
    for (const [k, slot] of Object.entries(s)) {
      if (!out[k]) out[k] = { n: 0 };
      const dst = out[k];
      dst.n += slot.n;
      if (slot.sum !== undefined) dst.sum = (dst.sum ?? 0) + slot.sum;
      if (slot.min !== undefined)
        dst.min = dst.min === undefined ? slot.min : Math.min(dst.min, slot.min);
      if (slot.max !== undefined)
        dst.max = dst.max === undefined ? slot.max : Math.max(dst.max, slot.max);
      if (slot.trueCount !== undefined) dst.trueCount = (dst.trueCount ?? 0) + slot.trueCount;
      if (slot.falseCount !== undefined) dst.falseCount = (dst.falseCount ?? 0) + slot.falseCount;
    }
  }
  return out;
}

export function mergeProtocolMixMaps(
  mixes: readonly Record<string, unknown>[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const mix of mixes) {
    for (const [k, v] of Object.entries(mix)) {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) continue;
      out[k] = (out[k] ?? 0) + n;
    }
  }
  return out;
}
