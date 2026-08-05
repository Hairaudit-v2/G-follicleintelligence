/**
 * Server entry for Team directory loaders that touch the database.
 * Prefer this barrel for pages and server actions.
 * Client code must not import this module — use `@/src/lib/team/directory`
 * for pure types / projections / clinical picker helpers.
 */

import "server-only";

export {
  enrichStaffPickerOptionsWithReadiness,
  loadClinicalStaffPickerOptions,
  loadProcedureTeamPickerOptions,
} from "@/src/lib/team/directory/clinicalStaffPickerLoader.server";
