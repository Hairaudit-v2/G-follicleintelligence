/**
 * Audit metadata helpers — record personKey + dual ids without rewriting history.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type { PayrollAuditIdentityRef } from "@/src/lib/team/payroll/types";

export function buildPayrollAuditIdentityRef(identity: StaffIdentity): PayrollAuditIdentityRef {
  return {
    personKey: identity.personKey,
    staffId: identity.staffId,
    staffMemberId: identity.staffMemberId,
    linkStatus: identity.integrity.linkStatus,
  };
}

/**
 * Merge identity refs into mutation metadata envelopes.
 * Does not overwrite existing financial keys.
 */
export function mergePayrollAuditIdentityMetadata(
  metadata: Record<string, unknown> | null | undefined,
  identity: StaffIdentity
): Record<string, unknown> {
  const base = metadata && typeof metadata === "object" ? { ...metadata } : {};
  return {
    ...base,
    payrollIdentity: buildPayrollAuditIdentityRef(identity),
  };
}
