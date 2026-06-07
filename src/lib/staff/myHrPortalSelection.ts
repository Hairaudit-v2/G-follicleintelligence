import { normalizeFiStaffSourceSystem } from "@/src/lib/staff/staffSourceIdsNormalize";

/** Preferred `fi_staff_source_ids.source_system` values for HR portal (first match with a safe URL wins). */
export const HR_PORTAL_SOURCE_SYSTEM_PRIORITY = ["iiohr_hr", "iiohr", "hr"] as const;

export type HrPortalSourceIdInput = {
  source_system: string;
  source_url: string | null;
};

/**
 * HR portal links must be plain HTTP(S) navigations (no `javascript:` etc.).
 */
export function isAllowedHrPortalUrl(raw: string | null | undefined): boolean {
  const u = typeof raw === "string" ? raw.trim() : "";
  if (!u) return false;
  const lower = u.toLowerCase();
  return lower.startsWith("https://") || lower.startsWith("http://");
}

/**
 * Pick the best HR portal URL for the signed-in staff member's source-id rows.
 * Respects {@link HR_PORTAL_SOURCE_SYSTEM_PRIORITY}; invalid URLs are skipped.
 */
export function pickHrPortalFromSourceIds(rows: HrPortalSourceIdInput[]): {
  hrPortalUrl: string | null;
  sourceSystem: string | null;
  hasHrLink: boolean;
} {
  for (const sys of HR_PORTAL_SOURCE_SYSTEM_PRIORITY) {
    for (const row of rows) {
      if (normalizeFiStaffSourceSystem(row.source_system) !== sys) continue;
      const url = row.source_url != null ? String(row.source_url).trim() : "";
      if (!isAllowedHrPortalUrl(url)) continue;
      return { hrPortalUrl: url, sourceSystem: sys, hasHrLink: true };
    }
  }
  return { hrPortalUrl: null, sourceSystem: null, hasHrLink: false };
}
