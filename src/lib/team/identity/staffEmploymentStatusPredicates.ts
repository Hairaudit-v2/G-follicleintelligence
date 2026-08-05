/**
 * Leaf employment-status predicates (no domain cycles).
 *
 * Split from staffLifecycleCore so hrReconciliationEligibleCore can classify
 * departed staff without importing staffLifecycleCore (documented B0 cycle break).
 */

import type { StaffEmploymentStatus } from "@/src/lib/team/identity/staffLifecycleTypes";
import {
  OPERATIONALLY_INELIGIBLE_EMPLOYMENT_STATUSES,
  SCHEDULING_EXCLUDED_EMPLOYMENT_STATUSES,
  STAFF_EMPLOYMENT_STATUSES,
} from "@/src/lib/team/identity/staffLifecycleTypes";

export function parseStaffEmploymentStatus(raw: unknown): StaffEmploymentStatus {
  const value = String(raw ?? "active")
    .trim()
    .toLowerCase();
  if ((STAFF_EMPLOYMENT_STATUSES as readonly string[]).includes(value)) {
    return value as StaffEmploymentStatus;
  }
  return "active";
}

export function isOperationallyIneligible(status: StaffEmploymentStatus): boolean {
  return OPERATIONALLY_INELIGIBLE_EMPLOYMENT_STATUSES.has(status);
}

export function isSchedulingExcluded(status: StaffEmploymentStatus): boolean {
  return SCHEDULING_EXCLUDED_EMPLOYMENT_STATUSES.has(status);
}

export function shouldDeactivateOnEmploymentChange(
  status: StaffEmploymentStatus,
  archiveFromActive?: boolean
): boolean {
  if (archiveFromActive) return true;
  return isOperationallyIneligible(status) || status === "inactive";
}
