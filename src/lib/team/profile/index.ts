/**
 * Public Team profile API — composition types and pure helpers.
 * Server loader: `loadStaffProfileHub.server.ts` (import via dedicated server entry when needed).
 * Consumers import identity only from `@/src/lib/team/identity` or `.../server`.
 */

export type {
  LoadStaffProfileHubInput,
  LoadStaffProfileHubResult,
  StaffProfileActionFlags,
  StaffProfileAttentionReason,
  StaffProfileAttentionSeverity,
  StaffProfileAttentionSource,
  StaffProfileHubModel,
  StaffProfileHubRejectionReason,
  StaffProfileIdentityActionFlags,
  StaffProfileOverviewSummary,
} from "@/src/lib/team/profile/types";

export {
  deriveStaffProfileAttentionReasons,
  severityForStaffProfileAttention,
} from "@/src/lib/team/profile/staffProfileAttentionReasons";

export {
  deriveStaffProfileActionFlags,
  isStaffProfileIdentityReadOnly,
} from "@/src/lib/team/profile/staffProfileActionFlags";

export {
  composeStaffProfileHubModel,
  projectStaffProfileOverviewSummary,
  toStaffProfileOverviewModel,
} from "@/src/lib/team/profile/projectStaffProfileOverview";
