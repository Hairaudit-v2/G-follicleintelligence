/**
 * Server entry for Team staff profile composition (FI-TEAM-COHESION-B1.6).
 */

import "server-only";

export {
  loadStaffProfileHub,
  loadStaffProfileHubBundle,
  type LoadStaffProfileHubOptions,
  type StaffProfileHubLoadBundle,
} from "@/src/lib/team/profile/loadStaffProfileHub.server";

export type {
  LoadStaffProfileHubInput,
  LoadStaffProfileHubResult,
  StaffProfileHubModel,
} from "@/src/lib/team/profile/types";
