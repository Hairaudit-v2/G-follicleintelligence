/**
 * Pure helpers for the staff role review workflow (payroll import follow-up).
 */

import type { FiStaffRow } from "@/src/lib/staff/staff.server";
import { mergeStaffWorkingHoursDocument, type StaffProfileExtras } from "@/src/lib/staff/staffProfileExtras";
import {
  isStaffRoleNeedsReview,
  NEEDS_REVIEW_STAFF_ROLE,
} from "@/src/lib/staff/staffRolePolicy";
import {
  parseStaffWeeklyHours,
  serializeStaffWeeklyHours,
  type StaffWeeklyHoursMap,
} from "@/src/lib/staff/staffWeeklyHours";
import type { StaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffHrNotificationNoLinkSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import type { StaffPayrollSourceDisplay } from "@/src/lib/staff/staffPayrollSourceDisplay";

export type StaffRoleReviewEditableRow = {
  staffId: string;
  full_name: string;
  email: string | null;
  mobile: string | null;
  staff_role: string;
  position_title: string | null;
  primary_clinic_id: string | null;
  weekly: StaffWeeklyHoursMap;
  is_active: boolean;
  payroll: StaffPayrollSourceDisplay | null;
  hrNotification: StaffHrNotificationSummary;
};

export type StaffRoleReviewProgress = {
  assigned: number;
  total: number;
  remaining: number;
  isComplete: boolean;
};

/** Active staff still on payroll default role `needs_review`. */
export function filterActiveNeedsReviewStaff(staff: FiStaffRow[]): FiStaffRow[] {
  return staff.filter((s) => s.is_active && isStaffRoleNeedsReview(s.staff_role));
}

export function buildStaffRoleReviewEditableRow(
  staff: FiStaffRow,
  payroll: StaffPayrollSourceDisplay | null,
  profile: StaffProfileExtras,
  hrNotification: StaffHrNotificationSummary = buildStaffHrNotificationNoLinkSummary()
): StaffRoleReviewEditableRow {
  return {
    staffId: staff.id,
    full_name: staff.full_name,
    email: staff.email,
    mobile: staff.mobile,
    staff_role: staff.staff_role,
    position_title: profile.position_title,
    primary_clinic_id: profile.primary_clinic_id,
    weekly: parseStaffWeeklyHours(staff.working_hours),
    is_active: staff.is_active,
    payroll,
    hrNotification,
  };
}

export function computeStaffRoleReviewProgress(rows: StaffRoleReviewEditableRow[]): StaffRoleReviewProgress {
  const total = rows.length;
  const assigned = rows.filter((r) => !isStaffRoleNeedsReview(r.staff_role)).length;
  return {
    assigned,
    total,
    remaining: total - assigned,
    isComplete: total === 0 || assigned === total,
  };
}

export function validateStaffRoleReviewSave(row: Pick<StaffRoleReviewEditableRow, "staff_role">): string | null {
  if (isStaffRoleNeedsReview(row.staff_role)) {
    return "Choose an operational role before saving — needs_review is not allowed.";
  }
  const role = row.staff_role.trim();
  if (!role) return "Role is required.";
  return null;
}

export function validateStaffRoleReviewSaveAll(
  rows: Pick<StaffRoleReviewEditableRow, "staff_role">[]
): string | null {
  const pending = rows.filter((r) => isStaffRoleNeedsReview(r.staff_role));
  if (pending.length === 0) return null;
  return `${pending.length} staff member${pending.length === 1 ? "" : "s"} still ha${pending.length === 1 ? "s" : "ve"} role needs_review. Assign roles before saving all.`;
}

export function buildStaffRoleReviewWorkingHours(
  row: Pick<StaffRoleReviewEditableRow, "weekly" | "position_title" | "primary_clinic_id">,
  existingWorkingHours?: Record<string, unknown> | null
): Record<string, unknown> {
  return mergeStaffWorkingHoursDocument(
    serializeStaffWeeklyHours(row.weekly),
    {
      position_title: row.position_title?.trim() || null,
      primary_clinic_id: row.primary_clinic_id?.trim() || null,
    },
    existingWorkingHours ?? null
  );
}

export function applyBulkPrimaryClinic(
  rows: StaffRoleReviewEditableRow[],
  selectedStaffIds: Set<string>,
  clinicId: string
): StaffRoleReviewEditableRow[] {
  const cid = clinicId.trim();
  if (!cid) return rows;
  return rows.map((r) => (selectedStaffIds.has(r.staffId) ? { ...r, primary_clinic_id: cid } : r));
}

export function applyBulkDefaultWeeklyHours(
  rows: StaffRoleReviewEditableRow[],
  selectedStaffIds: Set<string>,
  weekly: StaffWeeklyHoursMap
): StaffRoleReviewEditableRow[] {
  return rows.map((r) => (selectedStaffIds.has(r.staffId) ? { ...r, weekly: { ...weekly } } : r));
}

/** Bulk mark selected as non-clinical admin (clears needs_review when saved). */
export function applyBulkNonClinicalAdminRole(
  rows: StaffRoleReviewEditableRow[],
  selectedStaffIds: Set<string>
): StaffRoleReviewEditableRow[] {
  return rows.map((r) => (selectedStaffIds.has(r.staffId) ? { ...r, staff_role: "admin" } : r));
}

export function isPayrollMetadataReadOnly(): true {
  return true;
}

export const NON_CLINICAL_ADMIN_ROLE = "admin";

export { NEEDS_REVIEW_STAFF_ROLE };
