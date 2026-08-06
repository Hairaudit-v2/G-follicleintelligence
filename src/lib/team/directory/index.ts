/**
 * Public Team directory API — pure types, projection helpers, directory filters,
 * calendar-visible predicates, assignee labels, and clinical staff picker helpers
 * (client + server safe).
 *
 * Server loaders / asserts: `@/src/lib/team/directory/server`
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
  StaffDirectoryFilterState,
  StaffDirectoryLifecycleSignal,
  StaffDirectoryRowView,
} from "@/src/lib/team/directory/staffDirectoryFilters";

export {
  buildStaffDirectorySearchParams,
  enrichStaffDirectoryRows,
  filterStaffDirectoryRows,
  parseStaffDirectoryFiltersFromSearchParams,
} from "@/src/lib/team/directory/staffDirectoryFilters";

export type { CalendarVisibleStaffInput } from "@/src/lib/team/directory/calendarVisibleStaff";

export {
  CALENDAR_VISIBLE_CLINICAL_ROLES,
  isCalendarVisibleClinicalStaff,
  isNonCalendarSupportRole,
} from "@/src/lib/team/directory/calendarVisibleStaff";

export type { BookingAssignmentDisplay } from "@/src/lib/team/directory/staffAssigneeDisplay";

export {
  bookingAssigneeDisplayLabel,
  bookingAssignmentDisplay,
  staffOptionPrimaryLabel,
  staffOptionSubtitle,
} from "@/src/lib/team/directory/staffAssigneeDisplay";

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

export type { ClinicalStaffRoleOption } from "@/src/lib/team/directory/staffRolePolicy";

export {
  CLINICAL_STAFF_ROLE_OPTIONS,
  NEEDS_REVIEW_STAFF_ROLE,
  assertStaffBookableForClinicalWorkflow,
  isStaffBookableForClinicalWorkflow,
  isStaffRoleNeedsReview,
  staffClinicalBookingBlockReason,
} from "@/src/lib/team/directory/staffRolePolicy";
