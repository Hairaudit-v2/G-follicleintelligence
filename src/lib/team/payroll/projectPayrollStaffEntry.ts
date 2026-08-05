/**
 * Pure projection: StaffIdentity + wage facts → PayrollStaffEntry.
 * Never invents wage rates, payable hours, or approval outcomes.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { derivePayrollActionFlags } from "@/src/lib/team/payroll/payrollActionFlags";
import { derivePayrollIdentityAttentionReasons } from "@/src/lib/team/payroll/payrollIdentityAttentionReasons";
import type {
  PayrollPayBasis,
  PayrollStaffEntry,
  PayrollWageProjectionFacts,
} from "@/src/lib/team/payroll/types";

export function mapWageRateTypeToPayBasis(
  rateType: "hourly" | "daily" | "contractor" | null | undefined
): PayrollPayBasis {
  if (rateType === "hourly") return "hourly";
  if (rateType === "daily") return "salary";
  if (rateType === "contractor") return "contractor";
  return "unknown";
}

/**
 * Project a payroll staff entry.
 * Lifecycle-only remains valid for payroll setup when member id is present.
 * Scheduling-only returns an entry for historical attribution when facts say so.
 */
export function projectPayrollStaffEntry(
  identity: StaffIdentity,
  facts: PayrollWageProjectionFacts
): PayrollStaffEntry {
  const wageRecordId = facts.wageProfileId?.trim() || null;
  const payBasis = mapWageRateTypeToPayBasis(facts.rateType);
  const hasLifecycle = Boolean(identity.staffMemberId?.trim());
  const payrollReady = Boolean(wageRecordId) && hasLifecycle;

  return {
    identity: {
      personId: identity.personKey,
      staffId: identity.staffId,
      staffMemberId: identity.staffMemberId,
      userId: identity.userId,
      displayName: identity.displayName,
      integrity: identity.integrity,
    },
    employment: {
      status: identity.employmentStatus,
      startDate: facts.employmentStartDate ?? null,
      endDate: facts.employmentEndDate ?? null,
    },
    payroll: {
      payrollProfileId: wageRecordId,
      wageRecordId,
      payBasis,
      payrollReady,
    },
    attentionReasons: derivePayrollIdentityAttentionReasons(identity, facts),
    actions: derivePayrollActionFlags(identity, facts),
  };
}
