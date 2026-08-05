/**
 * Public Team commandCentre API — composition types and pure helpers.
 * Server loader: `loadTeamCommandCentre.server.ts` (import via `./server`).
 */

export type {
  CommandCentreAttentionSource,
  CommandCentreDomainHrefs,
  CommandCentrePrimaryAction,
  CommandCentreStaffSummary,
  RosterStaffSummary,
  StaffAccessSummary,
  StaffComplianceSummary,
  StaffDirectorySummary,
  StaffIdentitySummary,
  StaffOnboardingSummary,
  TeamAttentionQueueItem,
  TeamCommandCentreActionFlags,
  TeamCommandCentreKpis,
  TeamCommandCentreModel,
} from "@/src/lib/team/commandCentre/types";

export {
  buildCommandCentreDomainHrefs,
  resolveDirectoryIssueHref,
} from "@/src/lib/team/commandCentre/commandCentreHrefs";

export {
  deriveCommandCentreActionFlags,
  isAttentionActionAllowed,
  isCommandCentreIdentityUnsafe,
} from "@/src/lib/team/commandCentre/commandCentreActionFlags";

export {
  dedupeIdentitiesByPersonKey,
  projectCommandCentreStaffSummary,
  toStaffIdentitySummary,
} from "@/src/lib/team/commandCentre/projectWorkforceSummary";

export { composeAttentionQueue } from "@/src/lib/team/commandCentre/composeAttentionQueue";

export {
  composeCommandCentreKpis,
  isActiveWorkforce,
  isInWorkforceHeadcount,
} from "@/src/lib/team/commandCentre/composeCommandCentreKpis";
