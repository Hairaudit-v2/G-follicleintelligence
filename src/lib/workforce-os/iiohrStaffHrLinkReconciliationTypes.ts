/** IIOHR Evolved HR staff-feed row used for WorkforceOS HR link reconciliation. */
export type EvolvedStaffRecord = {
  /** Stable IIOHR staff record UUID — stored as `iiohr_staff_record_id`. */
  id: string;
  external_staff_id?: string | null;
  iiohr_user_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  [key: string]: unknown;
};

export type FiStaffMemberReconciliationRow = {
  id: string;
  tenant_id: string;
  email: string | null;
  full_name: string;
  iiohr_staff_record_id: string | null;
  archived_at?: string | null;
};

export type IiohrStaffHrLinkReconciliationLink = {
  staffMemberId: string;
  evolvedRecord: EvolvedStaffRecord;
};

export type IiohrStaffHrLinkReconciliationSummary = {
  matched: number;
  linked: number;
  skipped_blank_email: number;
  skipped_no_match: number;
  already_linked: number;
  warnings: string[];
};

export const IIOHR_EVOLVED_HR_SOURCE_SYSTEM = "iiohr_evolved_hr" as const;
export const STAFF_SYNCED_FROM_IIOHR_EVENT = "staff_synced_from_iiohr" as const;
export const IIOHR_HR_STAFF_RECONCILIATION_SOURCE = "iiohr_hr_staff_reconciliation" as const;
