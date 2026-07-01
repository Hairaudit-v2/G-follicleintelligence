import type { EvolvedStaffRecord } from "./iiohrStaffHrLinkReconciliationTypes";
import {
  buildArchivedHistoricalRecords,
  buildHrReconciliationMetrics,
  needsHrReconciliation,
} from "./hrReconciliationEligibleCore";
import {
  buildHrReconciliationFeedBlockedMessage,
  countExactNormalizedEmailMatches,
  resolveHrReconciliationFeedStatus,
  summarizeStaffMemberSourceSystems,
} from "./hrReconciliationCandidateCore";
import { buildReconciliationSuggestions } from "./staffLifecycleCore";
import type {
  HrReconciliationArchivedRecord,
  HrReconciliationDiagnostics,
  HrReconciliationFeedStatus,
  HrReconciliationMetrics,
  HrReconciliationSuggestion,
  StaffMemberLifecycleRow,
} from "./staffLifecycleTypes";

export type BuildHrReconciliationPageDataInput = {
  staffMembers: StaffMemberLifecycleRow[];
  evolvedStaffRecords: EvolvedStaffRecord[];
  diagnostics: HrReconciliationDiagnostics;
};

export type HrReconciliationPageData = {
  metrics: HrReconciliationMetrics;
  suggestions: HrReconciliationSuggestion[];
  archivedHistorical: HrReconciliationArchivedRecord[];
  diagnostics: HrReconciliationDiagnostics;
};

export function buildHrReconciliationPageData(
  input: BuildHrReconciliationPageDataInput
): HrReconciliationPageData {
  const metrics = buildHrReconciliationMetrics(input.staffMembers);
  const queueMembers = input.staffMembers.filter(needsHrReconciliation);
  const feedReady = input.diagnostics.feedStatus === "ok";

  const suggestions = feedReady
    ? buildReconciliationSuggestions({
        staffMembers: queueMembers,
        evolvedStaffRecords: input.evolvedStaffRecords,
      })
    : [];

  const archivedHistorical = buildArchivedHistoricalRecords(input.staffMembers);

  return { metrics, suggestions, archivedHistorical, diagnostics: input.diagnostics };
}

export function buildHrReconciliationDiagnostics(input: {
  staffMembers: StaffMemberLifecycleRow[];
  evolvedStaffRecords: EvolvedStaffRecord[];
  rawFeedRowCount: number;
  skippedNonUuidCount: number;
  staffIdentityLinksCount: number;
  lastSuccessfulIiohrSyncAt: string | null;
  feedUrlConfigured: boolean;
  feedUrlSource: string | null;
  feedKeyConfigured: boolean;
  cronSecretConfigured: boolean;
  evolvedPerthTenantIdConfigured: boolean;
  legacyFeedUrlConfigured: boolean;
  feedLoadError: string | null;
}): HrReconciliationDiagnostics {
  const feedStatus = resolveHrReconciliationFeedStatus({
    feedUrlConfigured: input.feedUrlConfigured,
    feedLoadError: input.feedLoadError,
    rawFeedRowCount: input.rawFeedRowCount,
    candidateCount: input.evolvedStaffRecords.length,
  });

  const exactNormalizedEmailMatchCount = countExactNormalizedEmailMatches({
    staffMembers: input.staffMembers,
    evolvedStaffRecords: input.evolvedStaffRecords,
  });

  return {
    fiStaffCount: input.staffMembers.length,
    iiohrRawFeedRowCount: input.rawFeedRowCount,
    iiohrCandidateCount: input.evolvedStaffRecords.length,
    iiohrCandidatesSkippedNonUuid: input.skippedNonUuidCount,
    exactNormalizedEmailMatchCount,
    staffIdentityLinksCount: input.staffIdentityLinksCount,
    lastSuccessfulIiohrSyncAt: input.lastSuccessfulIiohrSyncAt,
    fiStaffSourceSystemCounts: summarizeStaffMemberSourceSystems(input.staffMembers),
    feedStatus,
    feedLoadError: input.feedLoadError,
    feedBlockedMessage: buildHrReconciliationFeedBlockedMessage(feedStatus, input.feedLoadError),
    feedUrlConfigured: input.feedUrlConfigured,
    feedUrlSource: input.feedUrlSource,
    feedKeyConfigured: input.feedKeyConfigured,
    cronSecretConfigured: input.cronSecretConfigured,
    evolvedPerthTenantIdConfigured: input.evolvedPerthTenantIdConfigured,
    legacyFeedUrlConfigured: input.legacyFeedUrlConfigured,
  };
}

export {
  buildArchivedHistoricalRecords,
  buildHrReconciliationMetrics,
  isStaffArchived,
  isStaffHrLinkedForReconciliation,
  needsHrReconciliation,
} from "./hrReconciliationEligibleCore";

export type { HrReconciliationFeedStatus };
