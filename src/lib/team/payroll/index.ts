/**
 * Public Team payroll API — identity projection types and pure helpers.
 * Server loader / mutation gate: import via `./server`.
 */

export type {
  LoadPayrollStaffIdentityInput,
  PayrollAuditIdentityRef,
  PayrollIdentityAttentionReason,
  PayrollPayBasis,
  PayrollStaffEntry,
  PayrollStaffIdentitySummary,
  PayrollWageProjectionFacts,
} from "@/src/lib/team/payroll/types";

export {
  PAYROLL_IDENTITY_ATTENTION_LABELS,
  PAYROLL_IDENTITY_KPI_SOURCE_SNAPSHOT,
} from "@/src/lib/team/payroll/types";

export {
  derivePayrollActionFlags,
  isPayrollIdentityTargetUncertain,
  type PayrollActionFlags,
} from "@/src/lib/team/payroll/payrollActionFlags";

export { derivePayrollIdentityAttentionReasons } from "@/src/lib/team/payroll/payrollIdentityAttentionReasons";

export {
  buildPayrollAuditIdentityRef,
  mergePayrollAuditIdentityMetadata,
} from "@/src/lib/team/payroll/payrollAuditIdentity";

export {
  mapWageRateTypeToPayBasis,
  projectPayrollStaffEntry,
} from "@/src/lib/team/payroll/projectPayrollStaffEntry";
