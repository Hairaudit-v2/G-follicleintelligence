/**
 * Pure helpers for clinical staff pickers (client + server safe).
 */

import {
  deriveStaffReadinessState,
  isClinicalProviderStaffRole,
  isStaffClinicallyAvailable,
  staffClinicalAvailabilityReason,
  STAFF_READINESS_STATE_LABELS,
  type StaffReadinessState,
} from "@/src/lib/hr/hrStaffReadinessDashboard";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import {
  buildStaffHrNotificationNoLinkSummary,
  type StaffHrNotificationSummary,
} from "@/src/lib/staff/staffHrNotificationSummary";
import {
  isStaffBookableForClinicalWorkflow,
  isStaffRoleNeedsReview,
} from "@/src/lib/staff/staffRolePolicy";
import { staffOptionPrimaryLabel } from "@/src/lib/staff/staffAssigneeDisplay";

export const SUPPORT_STAFF_ROLES = ["admin", "reception", "coordinator"] as const;

export type ProcedureTeamSlotKind = "clinical" | "support";

export type ClinicalStaffPickerReadiness = {
  clinically_available: boolean;
  block_reason: string | null;
  readiness_state: StaffReadinessState;
  warning_label: string | null;
};

export type ClinicalStaffPickerOption = CrmShellUserPickerOption & {
  clinical_readiness: ClinicalStaffPickerReadiness;
};

export type ProcedureTeamPickerOption = {
  fi_user_id: string;
  staff_id: string;
  label: string;
  staff_role: string;
  clinical_readiness: ClinicalStaffPickerReadiness;
  allowed_slots: ProcedureTeamSlotKind[];
};

export const CLINICAL_ASSIGNMENT_ERROR_PREFIX =
  "This staff member is not clinically available yet: ";

export function staffReadinessDashboardPath(tenantId: string): string {
  return `/fi-admin/${tenantId.trim()}/hr/staff-readiness`;
}

export function isSupportStaffRole(staffRole: string | null | undefined): boolean {
  const role = String(staffRole ?? "")
    .trim()
    .toLowerCase();
  return (SUPPORT_STAFF_ROLES as readonly string[]).includes(role);
}

export function staffAllowedInProcedureSlot(
  staffRole: string | null | undefined,
  slot: ProcedureTeamSlotKind
): boolean {
  if (isStaffRoleNeedsReview(staffRole)) return false;
  if (slot === "support") return isSupportStaffRole(staffRole);
  return isClinicalProviderStaffRole(staffRole);
}

export function buildClinicalStaffPickerReadiness(input: {
  full_name: string;
  staff_role: string | null | undefined;
  is_active: boolean;
  working_hours: Record<string, unknown> | null | undefined;
  hr?: StaffHrNotificationSummary;
}): ClinicalStaffPickerReadiness {
  const hr = input.hr ?? buildStaffHrNotificationNoLinkSummary();
  const clinicallyAvailable = isStaffClinicallyAvailable({
    is_active: input.is_active,
    staff_role: input.staff_role,
    working_hours: input.working_hours,
    hr,
  });
  const blockReason = staffClinicalAvailabilityReason({
    full_name: input.full_name,
    is_active: input.is_active,
    staff_role: input.staff_role,
    working_hours: input.working_hours,
    hr,
  });
  const readinessState = deriveStaffReadinessState({
    is_active: input.is_active,
    staff_role: input.staff_role,
    working_hours: input.working_hours,
    hr,
  });
  return {
    clinically_available: clinicallyAvailable,
    block_reason: blockReason,
    readiness_state: readinessState,
    warning_label: blockReason ? compactReadinessWarningLabel(blockReason) : null,
  };
}

export function compactReadinessWarningLabel(blockReason: string): string {
  const r = blockReason.trim().toLowerCase();
  if (r.includes("inactive")) return "Inactive";
  if (r.includes("role needs review") || r.includes("needs review")) return "Needs role";
  if (r.includes("working hours")) return "Missing working hours";
  if (r.includes("hr/onboarding") || r.includes("hr information")) return "HR incomplete";
  if (r.includes("training") || r.includes("certificates")) return "Training incomplete";
  if (r.includes("stale")) return "HR sync stale";
  return blockReason;
}

export function enrichCrmShellStaffPickerOption(
  option: CrmShellUserPickerOption,
  hr?: StaffHrNotificationSummary
): ClinicalStaffPickerOption {
  const readiness = buildClinicalStaffPickerReadiness({
    full_name: option.full_name?.trim() || option.email?.trim() || "Staff",
    staff_role: option.staff_role,
    is_active: option.is_active !== false,
    working_hours: option.working_hours,
    hr,
  });
  return { ...option, clinical_readiness: readiness };
}

export function formatClinicalPickerOptionLabel(option: ClinicalStaffPickerOption): string {
  const base = staffOptionPrimaryLabel(option);
  const warn = option.clinical_readiness.warning_label;
  if (!warn || option.clinical_readiness.clinically_available) return base;
  return `${base} — ${warn}`;
}

export function canSelectStaffForClinicalPicker(option: ClinicalStaffPickerOption): boolean {
  return option.clinical_readiness.clinically_available;
}

export function buildProcedureTeamPickerOption(input: {
  staff: {
    id: string;
    fi_user_id: string;
    full_name: string;
    staff_role: string;
    is_active: boolean;
    working_hours: Record<string, unknown> | null | undefined;
  };
  hr?: StaffHrNotificationSummary;
}): ProcedureTeamPickerOption | null {
  const fiUserId = input.staff.fi_user_id.trim();
  if (!fiUserId) return null;
  const readiness = buildClinicalStaffPickerReadiness({
    full_name: input.staff.full_name,
    staff_role: input.staff.staff_role,
    is_active: input.staff.is_active,
    working_hours: input.staff.working_hours,
    hr: input.hr,
  });
  const allowed_slots: ProcedureTeamSlotKind[] = [];
  if (staffAllowedInProcedureSlot(input.staff.staff_role, "clinical")) {
    if (readiness.clinically_available) allowed_slots.push("clinical");
  }
  if (staffAllowedInProcedureSlot(input.staff.staff_role, "support")) {
    if (
      isStaffBookableForClinicalWorkflow({
        is_active: input.staff.is_active,
        staff_role: input.staff.staff_role,
      })
    ) {
      allowed_slots.push("support");
    }
  }
  return {
    fi_user_id: fiUserId,
    staff_id: input.staff.id,
    label: input.staff.full_name,
    staff_role: input.staff.staff_role,
    clinical_readiness: readiness,
    allowed_slots,
  };
}

export function canSelectStaffForProcedureSlot(
  option: ProcedureTeamPickerOption,
  slot: ProcedureTeamSlotKind
): boolean {
  return option.allowed_slots.includes(slot);
}

export function formatProcedureTeamPickerLabel(
  option: ProcedureTeamPickerOption,
  slot: ProcedureTeamSlotKind
): string {
  const base = `${option.label} · ${option.staff_role}`;
  if (canSelectStaffForProcedureSlot(option, slot)) return base;
  const warn = option.clinical_readiness.warning_label;
  if (warn) return `${base} — ${warn}`;
  if (!staffAllowedInProcedureSlot(option.staff_role, slot)) {
    return `${base} — Wrong role for ${slot} slot`;
  }
  return `${base} — Not available`;
}

export function clinicalAssignmentErrorMessage(blockReason: string | null | undefined): string {
  const reason = blockReason?.trim() || "Not clinically available";
  return `${CLINICAL_ASSIGNMENT_ERROR_PREFIX}${reason}.`;
}

export function readinessStateLabel(state: StaffReadinessState): string {
  return STAFF_READINESS_STATE_LABELS[state];
}
