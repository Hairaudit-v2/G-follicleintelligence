/**
 * Server entry for Team directory loaders and clinical availability asserts.
 * Prefer this barrel for pages and server actions.
 * Client code must not import this module — use `@/src/lib/team/directory`
 * for pure types / projections / filters / picker helpers.
 *
 * Cycle note (B2.2a): `src/lib/staff/staff.server` must import
 * `assertStaffClinicallyAvailableForAssignment` from
 * `./assertStaffClinicallyAvailable.server` (deep), not from this barrel,
 * so re-exporting directory page loaders does not cycle with `staff.server`.
 */

import "server-only";

export {
  enrichStaffPickerOptionsWithReadiness,
  loadClinicalStaffPickerOptions,
  loadProcedureTeamPickerOptions,
} from "@/src/lib/team/directory/clinicalStaffPickerLoader.server";

export type {
  StaffDirectoryClinicOption,
  StaffDirectoryPageResult,
} from "@/src/lib/team/directory/staffDirectoryLoader.server";

export { loadStaffDirectoryPage } from "@/src/lib/team/directory/staffDirectoryLoader.server";

export {
  assertWorkforceOsReadAccess,
  loadWorkforceOsDirectoryPage,
  loadWorkforceOsHrReconciliationPage,
  loadWorkforceOsStaffProfilePage,
} from "@/src/lib/team/directory/workforceOsDirectoryLoader.server";

export {
  StaffClinicalAvailabilityError,
  assertAppointmentProcedureStaffAssignments,
  assertFiUserAllowedForProcedureSlot,
  assertProcedureDayTeamAssignments,
  assertStaffAllowedForProcedureSlot,
  assertStaffClinicallyAvailableForAssignment,
  loadStaffMemberByFiUserId,
} from "@/src/lib/team/directory/assertStaffClinicallyAvailable.server";
