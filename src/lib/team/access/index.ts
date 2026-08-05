/**
 * Public Team access API — pure types and projection helpers.
 * Server loaders remain in `src/lib/workforce/staffAccessCentre.server.ts`
 * until a later access domain move; they must import from this index
 * (and identity/server), never from `team/identity/internal`.
 */

export type {
  StaffAccessAttentionReason,
  StaffAccessEntry,
  StaffAccessEntryStatus,
  StaffAccessIdentitySummary,
} from "@/src/lib/team/access/types";

export { STAFF_ACCESS_ATTENTION_LABELS } from "@/src/lib/team/access/types";

export {
  deriveStaffAccessAttentionReasons,
  mapAuthLoginToAccessEntryStatus,
  projectStaffAccessEntry,
  type StaffAccessProjectionFacts,
} from "@/src/lib/team/access/projectStaffAccessEntry";

export {
  applyStaffAccessEntryFlags,
  type StaffAccessCentreActionFlags,
} from "@/src/lib/team/access/toStaffAccessCentreRow";
