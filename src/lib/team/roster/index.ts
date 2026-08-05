/**
 * Public Team roster identity API — pure types and projection helpers.
 * Server loaders remain in `src/lib/workforce-os/` until a later domain move;
 * they must import from this index (and identity/server), never from `team/identity/internal`.
 */

export type {
  RosterStaffAttentionReason,
  RosterStaffEntry,
  RosterStaffIdentitySummary,
} from "@/src/lib/team/roster/types";

export { ROSTER_STAFF_ATTENTION_LABELS } from "@/src/lib/team/roster/types";

export { deriveRosterIdentityAttentionReasons } from "@/src/lib/team/roster/rosterIdentityAttentionReasons";

export {
  deriveRosterIdentityActionFlags,
  indexRosterMemberContextByStaffId,
  isRosterIdentityTargetUncertain,
  toRosterStaffMemberContext,
  type RosterIdentityActionFlags,
} from "@/src/lib/team/roster/rosterIdentityEligibilityBridge";

export {
  projectRosterStaffEntry,
  type RosterStaffProjectionFacts,
} from "@/src/lib/team/roster/projectRosterStaffEntry";
