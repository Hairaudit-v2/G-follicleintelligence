/**
 * Pure CRM lead-owner / Assign contact eligibility.
 * Separates historical owner display from selectable future assignees.
 */

import {
  isOperationallyIneligible,
  parseStaffEmploymentStatus,
} from "@/src/lib/team/identity/staffLifecycleCore";
import type { StaffEmploymentStatus } from "@/src/lib/team/identity/staffLifecycleTypes";
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
 * on_leave and pending_onboarding remain assignable when staff is otherwise active
 * (assignment ≠ roster eligibility).
 */
export type CrmAssigneeStaffSignal = {
  /** Scheduling staff is_active flag */
  isActive: boolean;
  /** Lifecycle employment_status when known */
  employmentStatus?: string | null;
  /** Lifecycle archived_at when known */
  archivedAt?: string | null;
};

export type CrmAssigneeEligibilityInput = {
  fiUserId: string;
  /** fi_users.role when known */
  role?: string | null;
  /** Display email — used only to exclude synthetic smoke/test accounts from pickers. */
  email?: string | null;
  /**
   * Linked staff signal for this fi_user (single row convenience).
   * Prefer `staffRows` when multiple scheduling staff rows share one fi_user.
   */
  staff?: CrmAssigneeStaffSignal | null;
  /** All staff rows linked to this fi_user (authoritative when present). */
  staffRows?: readonly CrmAssigneeStaffSignal[] | null;
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
    | "synthetic_or_smoke_account"
    | "not_operator_without_staff"
    | "no_active_staff_link";
};

function normStatus(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Synthetic smoke/test accounts must not appear in live Assign contact lists.
 * Matches common CI/smoke identities without filtering real names.
 */
export function isCrmAssigneeSyntheticEmail(email: string | null | undefined): boolean {
  const e = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!e) return false;
  return (
    e.includes("smoketest") ||
    e.includes("smoke-test") ||
    e.includes("smoke_test") ||
    e.includes("smoke.test") ||
    e.startsWith("smoke+") ||
    e.includes("+smoke@") ||
    /@example\.(com|org|net)$/.test(e) ||
    e.endsWith(".test") ||
    e.includes("noreply@") ||
    e.includes("no-reply@")
  );
}

function staffRowEligible(staff: CrmAssigneeStaffSignal): CrmAssigneeEligibilityResult {
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
    const known = parseStaffEmploymentStatus(statusRaw);
    if (statusRaw === known && isOperationallyIneligible(known as StaffEmploymentStatus)) {
      return { eligible: false, reasonCode: "terminated_or_offboarded" };
    }
  }
  return { eligible: true, reasonCode: "ok" };
}

/**
 * Whether a tenant fi_user may be selected as a *new* lead primary owner.
 * Does not affect display of historical owners already on a lead.
 *
 * Rules:
 * - Synthetic/smoke emails → never assignable
 * - Any linked staff: assignable only if **at least one** row is active + lifecycle-eligible
 *   (if every linked staff is inactive/terminated, exclude even if fi_users.role is admin)
 * - No staff link: CRM mutation roles only (fi_admin / admin / crm_operator / owner)
 */
export function resolveCrmAssigneeEligibility(
  input: CrmAssigneeEligibilityInput
): CrmAssigneeEligibilityResult {
  const id = input.fiUserId?.trim();
  if (!id) {
    return { eligible: false, reasonCode: "no_valid_identity" };
  }

  if (isCrmAssigneeSyntheticEmail(input.email)) {
    return { eligible: false, reasonCode: "synthetic_or_smoke_account" };
  }

  const rows: CrmAssigneeStaffSignal[] =
    input.staffRows != null && input.staffRows.length > 0
      ? [...input.staffRows]
      : input.staff
        ? [input.staff]
        : [];

  if (rows.length > 0) {
    // Prefer any active eligible staff row; do not let an inactive row be overwritten by order.
    for (const row of rows) {
      const r = staffRowEligible(row);
      if (r.eligible) return r;
    }
    // Had staff, none eligible — surface strongest reason from first row
    return staffRowEligible(rows[0]!);
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
 * Filter owner picker options using eligibility signals.
 * `staffByFiUserId` may hold one signal or an array of signals per user.
 */
export function filterCrmAssignableOwnerOptions<
  T extends { id: string; role?: string | null; email?: string | null },
>(
  options: readonly T[],
  staffByFiUserId: ReadonlyMap<string, CrmAssigneeStaffSignal | readonly CrmAssigneeStaffSignal[]>
): T[] {
  return options.filter((o) => {
    const id = o.id.trim();
    const raw = staffByFiUserId.get(id);
    const staffRows = raw == null ? null : Array.isArray(raw) ? raw : [raw];
    return isCrmAssigneeEligible({
      fiUserId: id,
      role: o.role ?? null,
      email: o.email ?? null,
      staffRows,
    });
  });
}
