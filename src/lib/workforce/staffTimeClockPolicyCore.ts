/**
 * WorkforceOS PIN time clock — per-tenant policy (pure parse/merge).
 */

import {
  isPayPeriodFrequency,
  type PayPeriodFrequency,
} from "./payPeriodCore";

export type WorkforceTimeClockPolicy = {
  breaksEnabled: boolean;
  payPeriodFrequency: PayPeriodFrequency;
  /** Fortnightly anchor (YYYY-MM-DD); ignored for monthly. */
  payPeriodAnchor: string;
  autoCloseEnabled: boolean;
  /** Clinic-local hour (0–23) when open punches auto-close for the work date. */
  autoCloseLocalHour: number;
};

export const DEFAULT_WORKFORCE_TIME_CLOCK_POLICY: WorkforceTimeClockPolicy = {
  breaksEnabled: false,
  payPeriodFrequency: "fortnightly",
  payPeriodAnchor: "2026-01-01",
  autoCloseEnabled: true,
  autoCloseLocalHour: 23,
};

const METADATA_KEY = "workforce_time_clock";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseBooleanFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return null;
}

function parseHour(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(23, Math.max(0, Math.floor(n)));
}

/** Reads `metadata.workforce_time_clock` from fi_tenant_settings. */
export function parseWorkforceTimeClockPolicy(
  metadata: Record<string, unknown> | null | undefined
): WorkforceTimeClockPolicy {
  const root = asObject(metadata?.[METADATA_KEY]);
  if (!root) return { ...DEFAULT_WORKFORCE_TIME_CLOCK_POLICY };

  const freqRaw = String(root.pay_period_frequency ?? root.payPeriodFrequency ?? "").trim();
  const payPeriodFrequency = isPayPeriodFrequency(freqRaw)
    ? freqRaw
    : DEFAULT_WORKFORCE_TIME_CLOCK_POLICY.payPeriodFrequency;

  const anchorRaw = String(root.pay_period_anchor ?? root.payPeriodAnchor ?? "").trim();

  return {
    breaksEnabled:
      parseBooleanFlag(root.breaks_enabled) ??
      parseBooleanFlag(root.breaksEnabled) ??
      DEFAULT_WORKFORCE_TIME_CLOCK_POLICY.breaksEnabled,
    payPeriodFrequency,
    payPeriodAnchor: anchorRaw || DEFAULT_WORKFORCE_TIME_CLOCK_POLICY.payPeriodAnchor,
    autoCloseEnabled:
      parseBooleanFlag(root.auto_close_enabled) ??
      parseBooleanFlag(root.autoCloseEnabled) ??
      DEFAULT_WORKFORCE_TIME_CLOCK_POLICY.autoCloseEnabled,
    autoCloseLocalHour: parseHour(
      root.auto_close_local_hour ?? root.autoCloseLocalHour,
      DEFAULT_WORKFORCE_TIME_CLOCK_POLICY.autoCloseLocalHour
    ),
  };
}

/** Merges policy into tenant settings metadata without dropping unrelated keys. */
export function mergeWorkforceTimeClockPolicyIntoMetadata(
  metadata: Record<string, unknown> | null | undefined,
  policy: Partial<WorkforceTimeClockPolicy>
): Record<string, unknown> {
  const base = asObject(metadata) ?? {};
  const existing = asObject(base[METADATA_KEY]) ?? {};
  const current = parseWorkforceTimeClockPolicy(base);
  const merged: WorkforceTimeClockPolicy = {
    ...current,
    ...policy,
  };
  return {
    ...base,
    [METADATA_KEY]: {
      ...existing,
      breaks_enabled: merged.breaksEnabled,
      pay_period_frequency: merged.payPeriodFrequency,
      pay_period_anchor: merged.payPeriodAnchor,
      auto_close_enabled: merged.autoCloseEnabled,
      auto_close_local_hour: merged.autoCloseLocalHour,
    },
  };
}