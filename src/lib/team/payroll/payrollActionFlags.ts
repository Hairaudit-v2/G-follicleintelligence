/**
 * Payroll identity action flags — identity gate only.
 * Wage / timesheet / approval policy remains in workforce payroll engines.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type { PayrollWageProjectionFacts } from "@/src/lib/team/payroll/types";

export function isPayrollIdentityTargetUncertain(identity: StaffIdentity): boolean {
  const { linkStatus } = identity.integrity;
  return (
    linkStatus === "ambiguous" ||
    linkStatus === "cross_tenant_mismatch" ||
    linkStatus === "invalid"
  );
}

export type PayrollActionFlags = {
  canEditPayrollProfile: boolean;
  canApproveTimesheet: boolean;
  canResolveIdentity: boolean;
};

/**
 * Compose payroll action flags from identity + domain permission facts.
 * Suspended login does not by itself block pay eligibility flags.
 * Ambiguous / cross-tenant / invalid suppress edit and approve.
 */
export function derivePayrollActionFlags(
  identity: StaffIdentity,
  facts: Pick<
    PayrollWageProjectionFacts,
    "canEditPayrollProfile" | "canApproveTimesheet" | "historicalAttributionOnly"
  >
): PayrollActionFlags {
  const uncertain = isPayrollIdentityTargetUncertain(identity);
  const hasLifecycle = Boolean(identity.staffMemberId?.trim());
  const historical = Boolean(facts.historicalAttributionOnly);

  if (uncertain) {
    return {
      canEditPayrollProfile: false,
      canApproveTimesheet: false,
      canResolveIdentity: true,
    };
  }

  // Scheduling-only: historical attribution allowed; no payroll-profile edit.
  if (!hasLifecycle) {
    return {
      canEditPayrollProfile: false,
      canApproveTimesheet: false,
      canResolveIdentity: identity.integrity.linkStatus === "scheduling_only",
    };
  }

  if (historical) {
    return {
      canEditPayrollProfile: false,
      canApproveTimesheet: false,
      canResolveIdentity: false,
    };
  }

  return {
    canEditPayrollProfile: facts.canEditPayrollProfile !== false,
    canApproveTimesheet: facts.canApproveTimesheet !== false,
    canResolveIdentity: false,
  };
}
