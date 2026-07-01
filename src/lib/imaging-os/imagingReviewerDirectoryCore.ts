/**
 * ImagingOS Phase 7 — eligible imaging reviewer directory (pure logic).
 */

export const IMAGING_REVIEWER_ELIGIBLE_USER_ROLES = new Set([
  "fi_admin",
  "admin",
  "platform_admin",
  "fi_platform_admin",
  "clinical_lead",
  "surgeon",
  "doctor",
  "senior_nurse",
  "imaging_reviewer",
  "nurse",
  "crm_operator",
]);

export const IMAGING_REVIEWER_ELIGIBLE_STAFF_ROLES = new Set([
  "surgeon",
  "consultant",
  "nurse",
  "admin",
  "technician",
]);

export type ImagingReviewerDirectoryRow = {
  fi_user_id: string;
  email: string | null;
  user_role: string | null;
  staff_id: string | null;
  staff_role: string | null;
  display_name: string;
};

export function isEligibleImagingReviewerUserRole(role: string | null | undefined): boolean {
  if (!role?.trim()) return false;
  return IMAGING_REVIEWER_ELIGIBLE_USER_ROLES.has(role.trim().toLowerCase());
}

export function isEligibleImagingReviewerStaffRole(role: string | null | undefined): boolean {
  if (!role?.trim()) return false;
  return IMAGING_REVIEWER_ELIGIBLE_STAFF_ROLES.has(role.trim().toLowerCase());
}

export function buildImagingReviewerDisplayName(input: {
  fullName?: string | null;
  email?: string | null;
  userRole?: string | null;
  staffRole?: string | null;
  fiUserId: string;
}): string {
  const name = input.fullName?.trim();
  if (name) {
    const email = input.email?.trim();
    return email ? `${name} (${email})` : name;
  }
  const email = input.email?.trim();
  if (email) return email;
  const role = input.staffRole?.trim() || input.userRole?.trim();
  if (role) return `${role} · ${input.fiUserId.slice(0, 8)}`;
  return input.fiUserId.slice(0, 8);
}

export function mergeImagingReviewerDirectoryRows(
  staffLinked: ImagingReviewerDirectoryRow[],
  userOnly: ImagingReviewerDirectoryRow[]
): ImagingReviewerDirectoryRow[] {
  const byUserId = new Map<string, ImagingReviewerDirectoryRow>();
  for (const row of staffLinked) byUserId.set(row.fi_user_id, row);
  for (const row of userOnly) {
    if (!byUserId.has(row.fi_user_id)) byUserId.set(row.fi_user_id, row);
  }
  return [...byUserId.values()].sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export function resolveReviewerLabelFromDirectory(
  directory: ImagingReviewerDirectoryRow[],
  fiUserId: string | null | undefined
): string | null {
  if (!fiUserId?.trim()) return null;
  return directory.find((r) => r.fi_user_id === fiUserId.trim())?.display_name ?? null;
}