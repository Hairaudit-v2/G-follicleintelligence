/**
 * Internal identity row shapes shared by loaders and pure normalisation.
 * Not a public API.
 */

export type StaffIdentitySchedulingRow = {
  id: string;
  tenant_id: string;
  fi_user_id: string | null;
  full_name: string;
  email: string | null;
  staff_role: string;
  is_active: boolean;
  working_hours: Record<string, unknown>;
  staff_metadata: Record<string, unknown>;
};

export type StaffIdentityLifecycleRow = {
  id: string;
  tenant_id: string;
  fi_staff_id: string | null;
  full_name: string;
  email: string | null;
  employment_status: string;
  role_code: string | null;
  clinic_id: string | null;
  archived_at: string | null;
  merged_into: string | null;
  system_access_revoked: boolean | null;
  iiohr_staff_record_id: string | null;
  iiohr_user_id: string | null;
  source_system: string | null;
  source_synced_at: string | null;
};

/** Active for ambiguity — not archived and not merged away. */
export function isActiveLifecycleRow(row: StaffIdentityLifecycleRow): boolean {
  return !row.archived_at?.trim() && !row.merged_into?.trim();
}

/** Eligible to contribute employment/archive signals (excludes merged duplicates). */
export function isUsableLifecycleRow(row: StaffIdentityLifecycleRow): boolean {
  return !row.merged_into?.trim();
}
