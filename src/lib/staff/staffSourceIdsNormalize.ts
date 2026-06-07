/**
 * Pure helpers for `fi_staff_source_ids`: trim/slug-style normalisation before DB writes or lookups.
 * DB uniqueness uses raw columns; call these from ingest/sync so `source_system` keys stay stable.
 */

/** Row shape aligned with `fi_staff_source_ids` (for typing payloads and query results). */
export type FiStaffSourceIdRow = {
  id: string;
  tenant_id: string;
  staff_id: string;
  source_system: string;
  source_staff_id: string;
  source_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Input for creating or matching a staff source id (tenant + staff UUIDs are not normalised here). */
export type FiStaffSourceIdKeyInput = {
  tenantId: string;
  staffId: string;
  sourceSystem: string;
  sourceStaffId: string;
};

export type NormalizedFiStaffSourceIdKey = {
  tenantId: string;
  staffId: string;
  sourceSystem: string;
  sourceStaffId: string;
};

/**
 * Normalises producer slugs (e.g. `iiohr_hr`, `IIOHR_ACADEMY`) to lowercase trimmed ASCII for stable uniqueness.
 */
export function normalizeFiStaffSourceSystem(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Normalises external staff ids: trim only (producer ids may be case-sensitive).
 */
export function normalizeFiStaffSourceStaffId(raw: string): string {
  return raw.trim();
}

/** Empty or whitespace-only URL becomes `null`. */
export function normalizeFiStaffSourceUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  return t ? t : null;
}

/** Ensures a plain object for `metadata` (default `{}`). */
export function normalizeFiStaffSourceMetadata(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/**
 * Returns normalised key parts for inserts and dedupe lookups.
 * `tenantId` / `staffId` are trimmed only (UUIDs must stay canonical).
 */
export function normalizeFiStaffSourceIdKey(input: FiStaffSourceIdKeyInput): NormalizedFiStaffSourceIdKey {
  return {
    tenantId: input.tenantId.trim(),
    staffId: input.staffId.trim(),
    sourceSystem: normalizeFiStaffSourceSystem(input.sourceSystem),
    sourceStaffId: normalizeFiStaffSourceStaffId(input.sourceStaffId),
  };
}
