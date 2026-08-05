/**
 * Server entry for Team Command Centre composition.
 */

import "server-only";

export {
  loadTeamCommandCentre,
  type LoadTeamCommandCentreOptions,
} from "@/src/lib/team/commandCentre/loadTeamCommandCentre.server";

export {
  adaptTeamCommandCentreToPageData,
  mapTeamAttentionToLegacyQueue,
  mergeCommandCentreKpis,
  type AdaptTeamCommandCentreInput,
  type WorkforceCommandCentrePageData,
} from "@/src/lib/team/commandCentre/adaptCommandCentrePage";
