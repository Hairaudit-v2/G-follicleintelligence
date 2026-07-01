import type { EvolvedStaffRecord } from "./iiohrStaffHrLinkReconciliationTypes";
import {
  buildArchivedHistoricalRecords,
  buildHrReconciliationMetrics,
  needsHrReconciliation,
} from "./hrReconciliationEligibleCore";
import { buildReconciliationSuggestions } from "./staffLifecycleCore";
import type {
  HrReconciliationArchivedRecord,
  HrReconciliationMetrics,
  HrReconciliationSuggestion,
  StaffMemberLifecycleRow,
} from "./staffLifecycleTypes";

export type BuildHrReconciliationPageDataInput = {
  staffMembers: StaffMemberLifecycleRow[];
  evolvedStaffRecords: EvolvedStaffRecord[];
};

export type HrReconciliationPageData = {
  metrics: HrReconciliationMetrics;
  suggestions: HrReconciliationSuggestion[];
  archivedHistorical: HrReconciliationArchivedRecord[];
};

export function buildHrReconciliationPageData(
  input: BuildHrReconciliationPageDataInput
): HrReconciliationPageData {
  const metrics = buildHrReconciliationMetrics(input.staffMembers);
  const queueMembers = input.staffMembers.filter(needsHrReconciliation);
  const suggestions = buildReconciliationSuggestions({
    staffMembers: queueMembers,
    evolvedStaffRecords: input.evolvedStaffRecords,
  });
  const archivedHistorical = buildArchivedHistoricalRecords(input.staffMembers);

  return { metrics, suggestions, archivedHistorical };
}

export {
  buildArchivedHistoricalRecords,
  buildHrReconciliationMetrics,
  isStaffArchived,
  isStaffHrLinkedForReconciliation,
  needsHrReconciliation,
} from "./hrReconciliationEligibleCore";
