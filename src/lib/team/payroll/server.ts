/**
 * Server entry for Team payroll identity composition and mutation gates.
 */

import "server-only";

export {
  loadPayrollStaffContext,
  type LoadPayrollStaffContextOptions,
  type PayrollStaffContextModel,
} from "@/src/lib/team/payroll/loadPayrollStaffContext.server";

export {
  assertEligiblePayrollIdentityTarget,
  assertUsablePayrollIdentityTarget,
  PAYROLL_IDENTITY_TARGET_UNCERTAIN,
} from "@/src/lib/team/payroll/payrollIdentityMutationGate.server";
