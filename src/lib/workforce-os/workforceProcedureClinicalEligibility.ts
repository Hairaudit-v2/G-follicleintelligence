/**
 * Combines WorkforceOS readiness with AcademyOS procedure privilege eligibility.
 */

import type { ProcedurePrivilegeEligibilityResult } from "@/src/lib/academy-os/procedurePrivilegeTypes";
import { formatMissingProcedurePrivilegeReason } from "@/src/lib/academy-os/procedurePrivilegeEngine";
import type { WorkforceReadinessScoreInput } from "@/src/lib/workforce-os/workforceReadinessEngine";

import {
  canStaffBeAssignedClinically,
  type StaffClinicalAssignmentResult,
} from "./workforceReadinessClinicalEligibility";

export type StaffProcedureAssignmentInput = {
  readinessInput: WorkforceReadinessScoreInput;
  privilegeEligibility: ProcedurePrivilegeEligibilityResult;
};

export type StaffProcedureAssignmentResult = StaffClinicalAssignmentResult & {
  procedurePrivilegeStatus: ProcedurePrivilegeEligibilityResult["status"];
  procedurePrivilegeEligible: boolean;
  procedurePrivilegeWarnings: ProcedurePrivilegeEligibilityResult["warnings"];
  procedurePrivilegeSnapshot: Record<string, unknown>;
};

function hasConfiguredRequirements(eligibility: ProcedurePrivilegeEligibilityResult): boolean {
  return !eligibility.warnings.includes("no_privilege_requirement_configured");
}

/**
 * Determines whether staff can be assigned to a clinical event role considering readiness + procedure privileges.
 * Missing privilege blocks only when requirements are configured for the role/event.
 */
export function canStaffBeAssignedToProcedure(
  input: StaffProcedureAssignmentInput
): StaffProcedureAssignmentResult {
  const readiness = canStaffBeAssignedClinically(input.readinessInput);
  const privilege = input.privilegeEligibility;
  const requirementsConfigured = hasConfiguredRequirements(privilege);

  const procedurePrivilegeSnapshot = {
    procedure_privilege_status: privilege.status,
    required_procedure_keys: privilege.missingRequirements.map((m) => m.requiredProcedureKey),
    matched_privileges: privilege.matchedPrivilege
      ? [
          {
            id: privilege.matchedPrivilege.id,
            procedure_key: privilege.matchedPrivilege.procedureKey,
            privilege_level: privilege.matchedPrivilege.privilegeLevel,
            privilege_status: privilege.matchedPrivilege.privilegeStatus,
            clinic_id: privilege.matchedPrivilege.clinicId,
          },
        ]
      : [],
    privilege_warnings: privilege.warnings,
  };

  const base: StaffProcedureAssignmentResult = {
    ...readiness,
    procedurePrivilegeStatus: privilege.status,
    procedurePrivilegeEligible: privilege.eligible || !requirementsConfigured,
    procedurePrivilegeWarnings: privilege.warnings,
    procedurePrivilegeSnapshot,
  };

  if (!readiness.eligible) {
    return base;
  }

  if (requirementsConfigured && !privilege.eligible) {
    const missingReason = formatMissingProcedurePrivilegeReason(privilege);
    return {
      ...base,
      eligible: false,
      procedurePrivilegeEligible: false,
      reason: missingReason ?? "Missing procedure privilege",
    };
  }

  return base;
}
