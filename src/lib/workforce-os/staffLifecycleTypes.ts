/** WorkforceOS staff employment lifecycle states. */
export const STAFF_EMPLOYMENT_STATUSES = [
  "active",
  "inactive",
  "on_leave",
  "pending_onboarding",
  "terminated",
  "resigned",
  "contract_ended",
  "suspended",
] as const;

export type StaffEmploymentStatus = (typeof STAFF_EMPLOYMENT_STATUSES)[number];

/** Statuses that remove staff from active operational workforce. */
export const OPERATIONALLY_INELIGIBLE_EMPLOYMENT_STATUSES: ReadonlySet<StaffEmploymentStatus> =
  new Set(["terminated", "resigned", "contract_ended"]);

/** Statuses that block scheduling / roster / surgery pools. */
export const SCHEDULING_EXCLUDED_EMPLOYMENT_STATUSES: ReadonlySet<StaffEmploymentStatus> =
  new Set(["on_leave", "terminated", "resigned", "contract_ended", "suspended"]);

export const STAFF_IDENTITY_SOURCES = [
  "local",
  "iiohr_evolved_hr",
  "academy_sync",
  "manual_import",
  "future_external_system",
] as const;

export type StaffIdentitySource = (typeof STAFF_IDENTITY_SOURCES)[number];

export const IIOHR_MANAGED_IDENTITY_SOURCES: ReadonlySet<StaffIdentitySource> = new Set([
  "iiohr_evolved_hr",
]);

export const STAFF_LIFECYCLE_AUDIT_EVENTS = {
  PROFILE_UPDATED: "staff_profile_updated",
  ARCHIVED: "staff_archived",
  RESTORED: "staff_restored",
  EMPLOYMENT_STATUS_CHANGED: "staff_employment_status_changed",
  HR_RECONCILED: "staff_hr_reconciled",
  HR_LINKED_MANUALLY: "staff_hr_linked_manually",
  HR_LINK_REMOVED: "staff_hr_link_removed",
} as const;

export type StaffLifecycleAuditEventType =
  (typeof STAFF_LIFECYCLE_AUDIT_EVENTS)[keyof typeof STAFF_LIFECYCLE_AUDIT_EVENTS];

export type StaffMemberLifecycleRow = {
  id: string;
  tenant_id: string;
  fi_staff_id: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  professional_title: string | null;
  phone: string | null;
  role_code: string | null;
  employment_type: string | null;
  employment_status: StaffEmploymentStatus;
  timezone: string | null;
  clinic_id: string | null;
  notes: string | null;
  identity_source: StaffIdentitySource;
  internal_tags: string[];
  iiohr_staff_record_id: string | null;
  iiohr_user_id: string | null;
  source_system: string | null;
  source_synced_at: string | null;
  source_snapshot: Record<string, unknown>;
  archived_at: string | null;
  employment_status_reason: string | null;
  employment_status_changed_at: string | null;
  employment_status_changed_by: string | null;
  last_manual_profile_update: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffProfileEditInput = {
  first_name?: string | null;
  last_name?: string | null;
  professional_title?: string | null;
  email?: string | null;
  phone?: string | null;
  role_code?: string | null;
  employment_type?: string | null;
  employment_status?: StaffEmploymentStatus;
  timezone?: string | null;
  clinic_id?: string | null;
  notes?: string | null;
  internal_tags?: string[];
};

export type EmploymentStatusChangeInput = {
  employment_status: StaffEmploymentStatus;
  reason: string;
  effective_date: string;
  archive_from_active?: boolean;
};

export type HrReconciliationSuggestion = {
  staffMemberId: string;
  fiStaffId: string | null;
  fiOsStaffName: string;
  fiOsEmail: string | null;
  suggestedIiohrRecord: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  confidenceScore: number;
  matchType: "exact_email" | "name_suggestion" | "none";
  canAutoApprove: boolean;
};
