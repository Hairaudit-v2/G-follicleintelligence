/**
 * Payroll identity mutation gate (FI-TEAM-COHESION-B1.8A).
 * Reject ambiguous / invalid / cross-tenant targets for wage and timesheet mutations.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { resolveStaffIdentity } from "@/src/lib/team/identity/server";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { isPayrollIdentityTargetUncertain } from "@/src/lib/team/payroll/payrollActionFlags";
import type { LoadPayrollStaffIdentityInput } from "@/src/lib/team/payroll/types";

export const PAYROLL_IDENTITY_TARGET_UNCERTAIN =
  "Staff identity requires reconciliation before this payroll action can run.";

/**
 * Reject unsafe identities for payroll-profile edit / timesheet create-approve.
 * Requires a lifecycle staffMemberId (wage profiles are member-keyed).
 */
export function assertUsablePayrollIdentityTarget(
  identity: StaffIdentity | null
): StaffIdentity {
  if (!identity) {
    throw new Error(PAYROLL_IDENTITY_TARGET_UNCERTAIN);
  }
  if (!identity.staffMemberId?.trim()) {
    throw new Error(PAYROLL_IDENTITY_TARGET_UNCERTAIN);
  }
  if (isPayrollIdentityTargetUncertain(identity)) {
    throw new Error(PAYROLL_IDENTITY_TARGET_UNCERTAIN);
  }
  if (identity.integrity.linkStatus === "cross_tenant_mismatch") {
    throw new Error(PAYROLL_IDENTITY_TARGET_UNCERTAIN);
  }
  return identity;
}

export async function assertEligiblePayrollIdentityTarget(
  input: LoadPayrollStaffIdentityInput,
  client?: SupabaseClient
): Promise<StaffIdentity> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const identity = await resolveStaffIdentity(
    input.by === "staffMemberId"
      ? {
          tenantId: tid,
          by: "staffMemberId",
          staffMemberId: assertNonEmptyUuid(input.staffMemberId, "staffMemberId"),
        }
      : {
          tenantId: tid,
          by: "staffId",
          staffId: assertNonEmptyUuid(input.staffId, "staffId"),
        },
    { client }
  );
  return assertUsablePayrollIdentityTarget(identity);
}
