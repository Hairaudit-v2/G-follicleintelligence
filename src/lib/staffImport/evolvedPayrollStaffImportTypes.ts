/**
 * Types for Evolved payroll export → FI OS staff import. Pure data shapes — no DB I/O.
 */

import type { PayrollSensitiveExportField } from "./evolvedPayrollStaffImportConstants";
import type {
  IiohrHrImportExistingSourceId,
  IiohrHrImportExistingStaff,
  IiohrHrImportExistingUser,
  IiohrHrStaffImportAction,
  IiohrHrStaffImportMatchKind,
  IiohrHrStaffImportValidationIssue,
} from "./iiohrHrStaffImportTypes";

export type EvolvedPayrollStaffImportRow = {
  external_staff_id: string;
  full_name: string;
  email: string | null;
  mobile: string | null;
  employment_type: string | null;
  start_date: string | null;
  end_date: string | null;
  hours_per_week: number | null;
  hours_per_day: number | null;
  /** Always `payroll_export` for this path. */
  source: typeof import("./evolvedPayrollStaffImportConstants").PAYROLL_IMPORT_SOURCE;
  /** Always `evolved_payroll` for this path. */
  source_system: typeof import("./evolvedPayrollStaffImportConstants").EVOLVED_PAYROLL_SOURCE_SYSTEM;
  clinic_display_name: string;
  is_active: boolean;
  staff_role: string;
};

export type EvolvedPayrollImportExistingStaff = IiohrHrImportExistingStaff & {
  mobile: string | null;
};

export type EvolvedPayrollStaffImportPlanInput = {
  tenantId: string;
  rows: EvolvedPayrollStaffImportRow[];
  existingUsers: IiohrHrImportExistingUser[];
  existingStaff: EvolvedPayrollImportExistingStaff[];
  existingStaffSourceIds: IiohrHrImportExistingSourceId[];
  sourceRowIndices?: number[];
  primaryFiClinicId: string | null;
};

export type EvolvedPayrollStaffImportRowPlan = {
  rowIndex: number;
  row: EvolvedPayrollStaffImportRow;
  matchKind: IiohrHrStaffImportMatchKind;
  matchedStaffId: string | null;
  matchedUserId: string | null;
  actions: IiohrHrStaffImportAction[];
  skippedDuplicate: boolean;
  skippedValidation: boolean;
  missingEmail: boolean;
  invalidEmail: boolean;
  needsRoleAssignment: boolean;
};

export type EvolvedPayrollStaffImportPlanResult = {
  perRow: EvolvedPayrollStaffImportRowPlan[];
  actions: IiohrHrStaffImportAction[];
  warnings: string[];
  validationIssues: IiohrHrStaffImportValidationIssue[];
};

export type EvolvedPayrollStaffImportPreviewBuckets = {
  new_staff: EvolvedPayrollStaffImportRowPlan[];
  matched_existing_staff: EvolvedPayrollStaffImportRowPlan[];
  missing_email: EvolvedPayrollStaffImportRowPlan[];
  invalid_email: EvolvedPayrollStaffImportRowPlan[];
  needs_role_assignment: EvolvedPayrollStaffImportRowPlan[];
  skipped_sensitive_fields: PayrollSensitiveExportField[];
  duplicate_email_skipped: EvolvedPayrollStaffImportRowPlan[];
};

export type EvolvedPayrollStaffParseResult = {
  rows: EvolvedPayrollStaffImportRow[];
  sourceRowIndices: number[];
  validationErrors: string[];
  skippedSensitiveFields: PayrollSensitiveExportField[];
  /** True when input looks like an Evolved payroll EmployeeData export. */
  isPayrollExport: boolean;
};
