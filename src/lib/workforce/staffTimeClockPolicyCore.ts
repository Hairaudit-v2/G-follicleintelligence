/**
 * WorkforceOS PIN time clock — per-tenant policy (pure parse/merge).
 */

export type WorkforceTimeClockPolicy = {
  /** When false, staff cannot start/end breaks and HR cannot add break corrections. */
  breaksEnabled: boolean;
};

export const DEFAULT_WORKFORCE_TIME_CLOCK_POLICY: WorkforceTimeClockPolicy = {
  breaksEnabled: false,
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

/** Reads `metadata.workforce_time_clock` from fi_tenant_settings. */
export function parseWorkforceTimeClockPolicy(
  metadata: Record<string, unknown> | null | undefined
): WorkforceTimeClockPolicy {
  const root = asObject(metadata?.[METADATA_KEY]);
  if (!root) return { ...DEFAULT_WORKFORCE_TIME_CLOCK_POLICY };

  const breaksEnabled =
    parseBooleanFlag(root.breaks_enabled) ??
    parseBooleanFlag(root.breaksEnabled) ??
    DEFAULT_WORKFORCE_TIME_CLOCK_POLICY.breaksEnabled;

  return { breaksEnabled };
}

/** Merges policy into tenant settings metadata without dropping unrelated keys. */
export function mergeWorkforceTimeClockPolicyIntoMetadata(
  metadata: Record<string, unknown> | null | undefined,
  policy: WorkforceTimeClockPolicy
): Record<string, unknown> {
  const base = asObject(metadata) ?? {};
  const existing = asObject(base[METADATA_KEY]) ?? {};
  return {
    ...base,
    [METADATA_KEY]: {
      ...existing,
      breaks_enabled: policy.breaksEnabled,
    },
  };
}