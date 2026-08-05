/**
 * Public Team directory API — pure types and projection helpers.
 * Server loaders remain in `src/lib/staff/staffDirectoryLoader.server.ts`
 * until a later directory domain move; they must import from this index
 * (and identity/server), never from `team/identity/internal`.
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
