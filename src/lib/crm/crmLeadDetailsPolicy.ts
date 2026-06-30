/**
 * Pure policy for CRM lead detail edits (Stage 2H): allowed picklist values,
 * metadata parsing, and changed-field reporting (no PII / before-after dumps).
 */

import { z } from "zod";

/** Controlled `fi_crm_leads.status` values for shell edits (legacy DB rows may differ until edited). */
export const CRM_LEAD_DETAIL_STATUS_VALUES = [
  "open",
  "contacted",
  "qualified",
  "nurturing",
  "proposal",
  "converted",
  "archived",
  "lost",
] as const;

export type CrmLeadDetailStatus = (typeof CRM_LEAD_DETAIL_STATUS_VALUES)[number];

export const CRM_LEAD_DETAIL_PRIORITY_VALUES = ["low", "normal", "high", "urgent"] as const;

export type CrmLeadDetailPriority = (typeof CRM_LEAD_DETAIL_PRIORITY_VALUES)[number];

export const crmLeadDetailStatusSchema = z.enum(CRM_LEAD_DETAIL_STATUS_VALUES);

export const crmLeadDetailPrioritySchema = z.union([
  z.enum(CRM_LEAD_DETAIL_PRIORITY_VALUES),
  z.null(),
  z.literal(""),
]);

/** Normalise priority for DB: empty string → null. */
export function normaliseLeadDetailPriority(p: string | null | undefined): string | null {
  const t = (p ?? "").trim();
  return t.length === 0 ? null : t;
}

export type LeadDetailComparableSnapshot = {
  summary: string;
  status: string;
  priority: string | null;
  primary_owner_user_id: string | null;
  organisation_id: string | null;
  clinic_id: string | null;
  metadata: Record<string, unknown>;
};

function sortJsonKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortJsonKeysDeep);
  const o = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) {
    out[k] = sortJsonKeysDeep(o[k]);
  }
  return out;
}

export function stableMetadataFingerprint(metadata: Record<string, unknown>): string {
  return JSON.stringify(sortJsonKeysDeep(metadata));
}

export function leadDetailSnapshotsEqual(
  a: LeadDetailComparableSnapshot,
  b: LeadDetailComparableSnapshot
): boolean {
  return (
    a.summary === b.summary &&
    a.status === b.status &&
    (a.priority ?? null) === (b.priority ?? null) &&
    (a.primary_owner_user_id ?? null) === (b.primary_owner_user_id ?? null) &&
    (a.organisation_id ?? null) === (b.organisation_id ?? null) &&
    (a.clinic_id ?? null) === (b.clinic_id ?? null) &&
    stableMetadataFingerprint(a.metadata) === stableMetadataFingerprint(b.metadata)
  );
}

const TRACKED_KEYS = [
  "summary",
  "status",
  "priority",
  "primary_owner_user_id",
  "organisation_id",
  "clinic_id",
  "metadata",
] as const;

export type LeadDetailTrackedKey = (typeof TRACKED_KEYS)[number];

/**
 * Returns stable snake_case field names that differ between snapshots (for activity.detail only).
 */
export function collectChangedLeadDetailKeys(
  before: LeadDetailComparableSnapshot,
  after: LeadDetailComparableSnapshot
): LeadDetailTrackedKey[] {
  const changed: LeadDetailTrackedKey[] = [];
  for (const k of TRACKED_KEYS) {
    if (k === "metadata") {
      if (
        stableMetadataFingerprint(before.metadata) !== stableMetadataFingerprint(after.metadata)
      ) {
        changed.push("metadata");
      }
      continue;
    }
    const av = after[k];
    const bv = before[k];
    if ((av ?? null) === (bv ?? null)) continue;
    changed.push(k);
  }
  return changed;
}

/**
 * Parse metadata from a JSON textarea; must be a plain object (not array).
 */
export function parseCrmLeadMetadataJsonInput(raw: string): Record<string, unknown> {
  const t = raw.trim();
  if (!t) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(t) as unknown;
  } catch {
    throw new Error("Metadata must be valid JSON.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Metadata must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

/**
 * Optional FI-admin merge patch from a JSON textarea.
 */
export function parseCrmLeadAdminMetadataMergeJson(raw: string): Record<string, unknown> {
  const t = raw.trim();
  if (!t) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(t) as unknown;
  } catch {
    throw new Error("Admin metadata merge must be valid JSON.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Admin metadata merge must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}
