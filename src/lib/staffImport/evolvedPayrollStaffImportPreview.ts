import type { PayrollSensitiveExportField } from "./evolvedPayrollStaffImportConstants";
import type {
  EvolvedPayrollStaffImportPlanResult,
  EvolvedPayrollStaffImportPreviewBuckets,
  EvolvedPayrollStaffImportRowPlan,
} from "./evolvedPayrollStaffImportTypes";

export function buildEvolvedPayrollStaffImportPreview(
  plan: EvolvedPayrollStaffImportPlanResult,
  skippedSensitiveFields: PayrollSensitiveExportField[]
): EvolvedPayrollStaffImportPreviewBuckets {
  const new_staff: EvolvedPayrollStaffImportRowPlan[] = [];
  const matched_existing_staff: EvolvedPayrollStaffImportRowPlan[] = [];
  const missing_email: EvolvedPayrollStaffImportRowPlan[] = [];
  const invalid_email: EvolvedPayrollStaffImportRowPlan[] = [];
  const needs_role_assignment: EvolvedPayrollStaffImportRowPlan[] = [];
  const duplicate_email_skipped: EvolvedPayrollStaffImportRowPlan[] = [];

  for (const p of plan.perRow) {
    if (p.skippedDuplicate) {
      duplicate_email_skipped.push(p);
      continue;
    }
    if (p.missingEmail) missing_email.push(p);
    if (p.invalidEmail) invalid_email.push(p);
    if (p.needsRoleAssignment && !p.skippedValidation) needs_role_assignment.push(p);

    if (p.skippedValidation) continue;

    if (p.matchKind === "source_id" || p.matchKind === "staff_email") {
      matched_existing_staff.push(p);
    } else if (p.matchKind === "none" || p.matchKind === "user_email") {
      new_staff.push(p);
    }
  }

  return {
    new_staff,
    matched_existing_staff,
    missing_email,
    invalid_email,
    needs_role_assignment,
    skipped_sensitive_fields: skippedSensitiveFields,
    duplicate_email_skipped,
  };
}
