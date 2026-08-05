/**
 * Public Team directory API — pure types, projection helpers, and clinical
 * staff picker eligibility helpers (client + server safe).
 *
 * Server loaders: `@/src/lib/team/directory/server`
 * Do not import `*.server` modules from client components.
 */

export type {
  StaffDirectoryAttentionReason,
  StaffDirectoryEntry,
  StaffDirectoryIdentityRef,
} from "@/src/lib/team/directory/types";

export { STAFF_DIRECTORY_ATTENTION_LABELS } from "@/src/lib/team/directory/types";

export {
  deriveStaffDirectoryAttentionReasons,
  projectStaffDirectoryEntry,
  toStaffDirectoryLifecycleSignal,
} from "@/src/lib/team/directory/projectStaffDirectoryEntry";

export type {
  ClinicalStaffPickerOption,
  ClinicalStaffPickerReadiness,
  ProcedureTeamPickerOption,
  ProcedureTeamSlotKind,
} from "@/src/lib/team/directory/clinicalStaffPicker";

export {
  CLINICAL_ASSIGNMENT_ERROR_PREFIX,
  SUPPORT_STAFF_ROLES,
  buildClinicalStaffPickerReadiness,
  buildProcedureTeamPickerOption,
  canSelectStaffForClinicalPicker,
  canSelectStaffForProcedureSlot,
  clinicalAssignmentErrorMessage,
  compactReadinessWarningLabel,
  enrichCrmShellStaffPickerOption,
  formatClinicalPickerOptionLabel,
  formatProcedureTeamPickerLabel,
  isSupportStaffRole,
  readinessStateLabel,
  staffAllowedInProcedureSlot,
  staffReadinessDashboardPath,
} from "@/src/lib/team/directory/clinicalStaffPicker";
