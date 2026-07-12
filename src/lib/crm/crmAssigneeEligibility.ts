/**
 * Pure CRM lead-owner / Assign contact eligibility.
 * Separates historical owner display from selectable future assignees.
 */

import {
  isOperationallyIneligible,
  parseStaffEmploymentStatus,
} from "@/src/lib/workforce-os/staffLifecycleCore";
import type { StaffEmploymentStatus } from "@/src/lib/workforce-os/staffLifecycleTypes";
import { CRM_MUTATION_ROLES_LOWER } from "@/src/lib/crm/crmGatePolicy";

/** Employment statuses that must not receive new CRM lead assignments. */
export const CRM_ASSIGNMENT_EXCLUDED_EMPLOYMENT_STATUSES: ReadonlySet<string> = new Set([
  "inactive",
  "terminated",
  "resigned",
  "contract_ended",
  "contract_expired",
  "suspended",
  "offboarded",
  "merged",
]);

/**
 * on_leave and pending_onboarding remain assignable for CRM lead ownership
 * (assignment ≠ roster eligibility).
 */
export type CrmAssigneeStaffSignal = {
  /** fi_staff.is_active */
  isActive: boolean;
  /** fi_staff_members.employment_status when known */
  employmentStatus?: string | null;
  /** fi_staff_members.archived_at when known */
  archivedAt?: string | null;
};

export type CrmAssigneeEligibilityInput = {
  fiUserId: string;
  /** fi_users.role when known */
  role?: string | null;
  /**
   * Linked staff signal for this fi_user. null/undefined = no staff profile
   * (operator-only account may still be assignable via CRM role).
   */
  staff?: CrmAssigneeStaffSignal | null;
};

export type CrmAssigneeEligibilityResult = {
  eligible: boolean;
  reasonCode:
    | "ok"
    | "inactive_staff"
    | "terminated_or_offboarded"
    | "archived"
    | "suspended"
    | "no_valid_identity"
    | "not_operator_without_staff";
};

function normStatus(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Whether a tenant fi_user may be selected as a *new* lead primary owner.
 * Does not affect display of historical owners already on a lead.
 */
export function resolveCrmAssigneeEligibility(
  input: CrmAssigneeEligibilityInput
): CrmAssigneeEligibilityResult {
  const id = input.fiUserId?.trim();
  if (!id) {
    return { eligible: false, reasonCode: "no_valid_identity" };
  }

  const staff = input.staff ?? null;
  if (staff) {
    if (staff.archivedAt != null && String(staff.archivedAt).trim()) {
      return { eligible: false, reasonCode: "archived" };
    }
    if (!staff.isActive) {
      return { eligible: false, reasonCode: "inactive_staff" };
    }
    const statusRaw = normStatus(staff.employmentStatus);
    if (statusRaw) {
      if (statusRaw === "suspended") {
        return { eligible: false, reasonCode: "suspended" };
      }
      if (CRM_ASSIGNMENT_EXCLUDED_EMPLOYMENT_STATUSES.has(statusRaw)) {
        return { eligible: false, reasonCode: "terminated_or_offboarded" };
      }
      // Known lifecycle statuses: reuse operational-ineligible helper
      // (does not exclude on_leave — assignment ≠ roster eligibility).
      const known = parseStaffEmploymentStatus(statusRaw);
      if (statusRaw === known && isOperationallyIneligible(known as StaffEmploymentStatus)) {
        return { eligible: false, reasonCode: "terminated_or_offboarded" };
      }
    }
    return { eligible: true, reasonCode: "ok" };
  }

  // No staff row: allow CRM shell mutation roles as operator owners only
  const role = String(input.role ?? "")
    .trim()
    .toLowerCase();
  if (CRM_MUTATION_ROLES_LOWER.has(role)) {
    return { eligible: true, reasonCode: "ok" };
  }

  return { eligible: false, reasonCode: "not_operator_without_staff" };
}

export function isCrmAssigneeEligible(input: CrmAssigneeEligibilityInput): boolean {
  return resolveCrmAssigneeEligibility(input).eligible;
}

export const CRM_ASSIGNEE_INELIGIBLE_USER_MESSAGE =
  "This staff member is no longer available for assignment. Choose another team member.";

/**
 * Filter owner picker options using eligibility signals keyed by fi_user id.
 * Options without a staff signal fall through to role-based eligibility when role is on the option.
 */
export function filterCrmAssignableOwnerOptions<
  T extends { id: string; role?: string | null },
>(
  options: readonly T[],
  staffByFiUserId: ReadonlyMap<string, CrmAssigneeStaffSignal>
): T[] {
  return options.filter((o) => {
    const id = o.id.trim();
    return isCrmAssigneeEligible({
      fiUserId: id,
      role: o.role ?? null,
      staff: staffByFiUserId.get(id) ?? null,
    });
  });
}
