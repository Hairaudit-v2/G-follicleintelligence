/**
 * FI-HUBSPOT-IMPORT-1C — pure owner-resolution ranking and filters (no I/O).
 */

import { createHash } from "node:crypto";

import type {
  HubspotOwnerResolutionFilter,
  HubspotOwnerResolutionState,
  HubspotOwnerStaffCandidate,
  HubspotOwnerWorkspaceRow,
  HubspotOwnerWorkspaceSummary,
} from "./hubspotOwnerResolutionTypes";
import {
  HUBSPOT_OWNER_RESOLUTION_BATCH_MAX,
  HUBSPOT_OWNER_RESOLUTION_MILESTONE_MAX_NEW,
} from "./hubspotOwnerResolutionTypes";

export function computeOwnerResolutionChecksum(
  proposals: Array<{ hubspotOwnerId: string; targetStaffId: string | null; resolutionState: string }>
): string {
  const canonical = [...proposals]
    .map((p) => `${p.hubspotOwnerId}|${p.resolutionState}|${p.targetStaffId ?? ""}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

export function rankStaffCandidates(input: {
  ownerEmail: string | null;
  ownerDisplayName: string | null;
  staff: Array<{
    staffId: string;
    fullName: string;
    role: string;
    isActive: boolean;
    email: string | null;
    alreadyHasHubspotOwner: boolean;
    existingHubspotOwnerId: string | null;
  }>;
}): HubspotOwnerStaffCandidate[] {
  const ownerEmail = input.ownerEmail?.trim().toLowerCase() ?? null;
  const ownerName = input.ownerDisplayName?.trim().toLowerCase() ?? null;
  const out: HubspotOwnerStaffCandidate[] = [];

  for (const s of input.staff) {
    const evidence: HubspotOwnerStaffCandidate["evidence"] = [];
    let rank = 100;
    let deterministic = false;
    const staffEmail = s.email?.trim().toLowerCase() ?? null;

    if (ownerEmail && staffEmail && ownerEmail === staffEmail) {
      evidence.push("exact_staff_email_within_tenant");
      rank = 1;
      deterministic = s.isActive && !s.alreadyHasHubspotOwner;
    }

    // Exact full name alone is never deterministic — only a ranked suggestion with label.
    if (ownerName && s.fullName.trim().toLowerCase() === ownerName) {
      evidence.push("exact_name_with_supporting_evidence");
      if (rank > 40) rank = 40;
      // Name alone cannot be deterministic.
      if (!evidence.includes("exact_staff_email_within_tenant")) {
        deterministic = false;
      }
    }

    if (evidence.length === 0) continue;

    out.push({
      staffId: s.staffId,
      fullName: s.fullName,
      role: s.role,
      status: s.isActive ? "active" : "inactive",
      email: s.email,
      alreadyHasHubspotOwner: s.alreadyHasHubspotOwner,
      existingHubspotOwnerId: s.existingHubspotOwnerId,
      evidence,
      rank,
      deterministic,
    });
  }

  return out.sort((a, b) => a.rank - b.rank || a.fullName.localeCompare(b.fullName));
}

/** Name-only suggestions must never auto-apply. */
export function canAutoApplyCandidate(c: HubspotOwnerStaffCandidate): boolean {
  if (!c.deterministic) return false;
  if (c.status !== "active") return false;
  if (c.alreadyHasHubspotOwner) return false;
  return c.evidence.includes("exact_staff_email_within_tenant");
}

export function deriveResolutionState(input: {
  hasAppliedMapping: boolean;
  savedState: HubspotOwnerResolutionState | null;
  archived: boolean;
  candidates: HubspotOwnerStaffCandidate[];
  conflictReason: string | null;
}): HubspotOwnerResolutionState {
  if (input.hasAppliedMapping) return "already_applied";
  // Proposed/mapped only after an explicit saved operator decision — never derive silently.
  if (input.savedState) return input.savedState;
  if (input.conflictReason) return "conflict";
  if (input.archived) return "archived_source_owner";
  if (input.candidates.length === 0) return "no_matching_staff";
  return "unresolved";
}

export function filterOwnerRows(
  rows: HubspotOwnerWorkspaceRow[],
  filter: HubspotOwnerResolutionFilter
): HubspotOwnerWorkspaceRow[] {
  switch (filter) {
    case "needs_attention":
      return rows.filter((r) =>
        ["unresolved", "proposed", "conflict", "no_matching_staff"].includes(r.resolutionState)
      );
    case "suggested_match":
      return rows.filter((r) => r.candidates.some(canAutoApplyCandidate) || r.resolutionState === "proposed");
    case "no_match":
      return rows.filter((r) => r.resolutionState === "no_matching_staff");
    case "archived":
      return rows.filter((r) => r.resolutionState === "archived_source_owner" || r.archived);
    case "historical_only":
      return rows.filter((r) => r.resolutionState === "historical_only");
    case "conflict":
      return rows.filter((r) => r.resolutionState === "conflict");
    case "mapped":
      return rows.filter((r) =>
        ["mapped", "already_applied"].includes(r.resolutionState)
      );
    case "all":
    default:
      return rows;
  }
}

export function summarizeOwnerWorkspace(rows: HubspotOwnerWorkspaceRow[]): HubspotOwnerWorkspaceSummary {
  const summary: HubspotOwnerWorkspaceSummary = {
    totalOwners: rows.length,
    mapped: 0,
    proposed: 0,
    unresolved: 0,
    archivedOrHistorical: 0,
    conflicts: 0,
    needingAttention: 0,
    excluded: 0,
    noMatchingStaff: 0,
    alreadyApplied: 0,
    relevantActiveCoveragePct: null,
    relevantActiveDenominator: 0,
    relevantActiveMapped: 0,
  };

  for (const r of rows) {
    switch (r.resolutionState) {
      case "mapped":
        summary.mapped += 1;
        break;
      case "already_applied":
        summary.alreadyApplied += 1;
        summary.mapped += 1;
        break;
      case "proposed":
        summary.proposed += 1;
        break;
      case "unresolved":
        summary.unresolved += 1;
        break;
      case "archived_source_owner":
      case "historical_only":
        summary.archivedOrHistorical += 1;
        break;
      case "conflict":
        summary.conflicts += 1;
        break;
      case "excluded":
        summary.excluded += 1;
        break;
      case "no_matching_staff":
        summary.noMatchingStaff += 1;
        break;
    }
  }

  summary.needingAttention = rows.filter((r) =>
    ["unresolved", "proposed", "conflict", "no_matching_staff"].includes(r.resolutionState)
  ).length;

  // Relevant = non-archived OR has owned records in migration scope.
  const relevant = rows.filter((r) => !r.archived || r.inMigrationCohort || r.ownedContacts + r.ownedDeals > 0);
  summary.relevantActiveDenominator = relevant.length;
  summary.relevantActiveMapped = relevant.filter((r) =>
    ["mapped", "already_applied"].includes(r.resolutionState)
  ).length;
  summary.relevantActiveCoveragePct =
    summary.relevantActiveDenominator > 0
      ? Math.round((summary.relevantActiveMapped / summary.relevantActiveDenominator) * 1000) / 10
      : null;

  return summary;
}

export function sortOwnerRows(rows: HubspotOwnerWorkspaceRow[]): HubspotOwnerWorkspaceRow[] {
  return [...rows].sort((a, b) => {
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    const aOwned = a.ownedContacts + a.ownedDeals + a.ownedTasks;
    const bOwned = b.ownedContacts + b.ownedDeals + b.ownedTasks;
    if (aOwned !== bOwned) return bOwned - aOwned;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function assertBatchSizeLimits(proposedMappingCount: number, milestoneNewTotal: number): void {
  if (proposedMappingCount > HUBSPOT_OWNER_RESOLUTION_BATCH_MAX) {
    throw new Error(
      `BATCH_LIMIT: cannot apply more than ${HUBSPOT_OWNER_RESOLUTION_BATCH_MAX} mappings in one 1C batch`
    );
  }
  if (milestoneNewTotal + proposedMappingCount > HUBSPOT_OWNER_RESOLUTION_MILESTONE_MAX_NEW) {
    throw new Error(
      `MILESTONE_LIMIT: 1C allows at most ${HUBSPOT_OWNER_RESOLUTION_MILESTONE_MAX_NEW} newly applied mappings`
    );
  }
}

export function sortPriorityForRow(input: {
  state: HubspotOwnerResolutionState;
  inMigrationCohort: boolean;
  hasDeterministicSuggestion: boolean;
  archived: boolean;
  ownedTotal: number;
}): number {
  if (input.state === "conflict") return 0;
  if (input.inMigrationCohort && ["proposed", "unresolved"].includes(input.state)) return 1;
  if (input.hasDeterministicSuggestion) return 2;
  if (input.ownedTotal > 0 && ["unresolved", "proposed", "no_matching_staff"].includes(input.state))
    return 3;
  if (input.archived || input.state === "archived_source_owner" || input.state === "historical_only")
    return 8;
  if (input.state === "excluded") return 9;
  if (["mapped", "already_applied"].includes(input.state)) return 10;
  return 5;
}
