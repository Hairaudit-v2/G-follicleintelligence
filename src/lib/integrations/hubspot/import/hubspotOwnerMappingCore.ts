/**
 * FI-HUBSPOT-IMPORT-1B — pure owner→staff mapping decisions (no I/O).
 */

import { createHash } from "node:crypto";

import { privacySafeSourceIdHash } from "./hubspotImportIdentity";
import {
  HUBSPOT_OWNER_MAPPING_DEFAULT_MAX,
  HUBSPOT_OWNER_MAPPING_EXPANSION_MAX,
  type HubspotOwnerMappingDecision,
  type HubspotOwnerMappingProposal,
  type HubspotOwnerMatchMethod,
} from "./hubspotOwnerMappingTypes";

export function hashEmailNormalized(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  return createHash("sha256").update(`email:${email.trim().toLowerCase()}`).digest("hex").slice(0, 16);
}

/** Explicit rejection of name-only matching (forbidden evidence). */
export function rejectNameOnlyMatch(_displayName: string | null | undefined): HubspotOwnerMappingDecision {
  return "reject_name_only";
}

export type OwnerCandidateInput = {
  hubspotOwnerId: string;
  tenantId: string;
  integrationId: string;
  emailNormalized: string | null;
  archived: boolean;
  displayName: string | null;
};

export type StaffCandidate = {
  staffId: string;
  tenantId: string;
  isActive: boolean;
  emailNormalized: string | null;
};

export type ExistingOwnerMapping = {
  hubspotOwnerId: string;
  staffId: string;
  mappingRowId: string;
  importBatchId: string | null;
};

export type OwnerMappingEvalContext = {
  expectedTenantId: string;
  /** email → staff candidates (same tenant only) */
  staffByEmail: Map<string, StaffCandidate[]>;
  /** hubspot owner id → existing mapping */
  existingByOwnerId: Map<string, ExistingOwnerMapping>;
  /** staff id → existing hubspot owner mapping (one per staff due to unique index) */
  existingByStaffId: Map<string, ExistingOwnerMapping>;
  /** Optional explicit pre-approved pairs */
  preApproved?: Map<string, string>;
};

export function evaluateOwnerMapping(
  owner: OwnerCandidateInput,
  ctx: OwnerMappingEvalContext
): HubspotOwnerMappingProposal {
  const base = {
    hubspotOwnerId: owner.hubspotOwnerId,
    hubspotOwnerIdHash: privacySafeSourceIdHash(owner.hubspotOwnerId),
    tenantId: owner.tenantId,
    integrationId: owner.integrationId,
    emailNormalizedHash: hashEmailNormalized(owner.emailNormalized),
  };

  if (owner.tenantId !== ctx.expectedTenantId) {
    return {
      ...base,
      staffId: null,
      matchMethod: null,
      decision: "reject_wrong_tenant",
      reasonCode: "tenant_mismatch_fail_closed",
      staffIsActive: null,
    };
  }

  if (!owner.hubspotOwnerId.trim()) {
    return {
      ...base,
      staffId: null,
      matchMethod: null,
      decision: "quarantine_unresolved",
      reasonCode: "missing_hubspot_owner_id",
      staffIsActive: null,
    };
  }

  if (owner.archived) {
    return {
      ...base,
      staffId: null,
      matchMethod: null,
      decision: "skip_archived_owner",
      reasonCode: "archived_hubspot_owner",
      staffIsActive: null,
    };
  }

  const existing = ctx.existingByOwnerId.get(owner.hubspotOwnerId);
  if (existing) {
    return {
      ...base,
      staffId: existing.staffId,
      matchMethod: "existing_staff_source_id",
      decision: "already_applied",
      reasonCode: "staff_source_id_already_present",
      staffIsActive: null,
    };
  }

  // Forbidden: name-only. If no email and only display name, reject.
  if (!owner.emailNormalized && owner.displayName?.trim()) {
    return {
      ...base,
      staffId: null,
      matchMethod: null,
      decision: rejectNameOnlyMatch(owner.displayName),
      reasonCode: "name_only_match_forbidden",
      staffIsActive: null,
    };
  }

  let matchMethod: HubspotOwnerMatchMethod | null = null;
  let staff: StaffCandidate | null = null;

  const preApprovedStaffId = ctx.preApproved?.get(owner.hubspotOwnerId);
  if (preApprovedStaffId) {
    // Pre-approved still requires the staff to exist in email map OR we accept explicit id via staff list.
    // Caller must populate staffByEmail / ensure staff is validated separately.
    matchMethod = "pre_approved_explicit_mapping";
  }

  if (owner.emailNormalized) {
    const candidates = (ctx.staffByEmail.get(owner.emailNormalized) ?? []).filter(
      (c) => c.tenantId === ctx.expectedTenantId
    );
    if (candidates.length > 1) {
      return {
        ...base,
        staffId: null,
        matchMethod: null,
        decision: "quarantine_ambiguous",
        reasonCode: "email_matches_multiple_staff",
        staffIsActive: null,
      };
    }
    if (candidates.length === 1) {
      staff = candidates[0];
      matchMethod = matchMethod ?? "exact_staff_email_within_tenant";
    }
  }

  if (preApprovedStaffId && !staff) {
    // Explicit mapping without email resolution — still need active staff validation from caller.
    return {
      ...base,
      staffId: preApprovedStaffId,
      matchMethod: "pre_approved_explicit_mapping",
      decision: "quarantine_unresolved",
      reasonCode: "pre_approved_requires_active_staff_validation",
      staffIsActive: null,
    };
  }

  if (!staff || !matchMethod) {
    return {
      ...base,
      staffId: null,
      matchMethod: null,
      decision: "quarantine_unresolved",
      reasonCode: "no_deterministic_active_staff_match",
      staffIsActive: null,
    };
  }

  if (!staff.isActive) {
    return {
      ...base,
      staffId: staff.staffId,
      matchMethod,
      decision: "quarantine_inactive_staff",
      reasonCode: "inactive_or_archived_staff_requires_approval",
      staffIsActive: false,
    };
  }

  const targetConflict = ctx.existingByStaffId.get(staff.staffId);
  if (targetConflict && targetConflict.hubspotOwnerId !== owner.hubspotOwnerId) {
    return {
      ...base,
      staffId: staff.staffId,
      matchMethod,
      decision: "conflict_target_has_other_owner",
      reasonCode: "staff_already_mapped_to_different_hubspot_owner",
      staffIsActive: true,
    };
  }

  // Source conflict: another path already mapped this owner (handled above via existingByOwnerId).
  // Defensive: if maps are inconsistent.
  for (const [oid, mapping] of ctx.existingByOwnerId) {
    if (oid === owner.hubspotOwnerId && mapping.staffId !== staff.staffId) {
      return {
        ...base,
        staffId: staff.staffId,
        matchMethod,
        decision: "conflict_source_mapped_elsewhere",
        reasonCode: "owner_already_mapped_to_different_staff",
        staffIsActive: true,
      };
    }
  }

  return {
    ...base,
    staffId: staff.staffId,
    matchMethod,
    decision: "apply_mapping",
    reasonCode: "deterministic_active_staff_match",
    staffIsActive: true,
  };
}

export function selectPilotProposals(
  proposals: HubspotOwnerMappingProposal[],
  options: { maxRecords: number; expandEnabled: boolean }
): {
  selected: HubspotOwnerMappingProposal[];
  rejectedOverLimit: HubspotOwnerMappingProposal[];
  maxAllowed: number;
} {
  const maxAllowed = options.expandEnabled
    ? Math.min(options.maxRecords, HUBSPOT_OWNER_MAPPING_EXPANSION_MAX)
    : Math.min(options.maxRecords, HUBSPOT_OWNER_MAPPING_DEFAULT_MAX);

  const applicable = proposals.filter((p) => p.decision === "apply_mapping");
  const selected = applicable.slice(0, maxAllowed);
  const rejectedOverLimit = applicable.slice(maxAllowed).map((p) => ({
    ...p,
    decision: "reject_over_limit" as const,
    reasonCode: "exceeds_approved_batch_size",
  }));

  return { selected, rejectedOverLimit, maxAllowed };
}

export function assertMutationAllowlist(table: string, operation: string): void {
  const allowed =
    (table === "fi_staff_source_ids" && (operation === "insert" || operation === "delete")) ||
    (table === "fi_import_batches" && (operation === "insert" || operation === "update"));
  if (!allowed) {
    throw new Error(`MUTATION_ALLOWLIST: refused ${operation} on ${table}`);
  }
}

export function emptyOwnerMappingCounts(): HubspotOwnerMappingProposal extends never
  ? never
  : {
      evaluated: number;
      proposedApply: number;
      alreadyApplied: number;
      quarantined: number;
      conflicts: number;
      wrongTenant: number;
      applied: number;
      rolledBack: number;
    } {
  return {
    evaluated: 0,
    proposedApply: 0,
    alreadyApplied: 0,
    quarantined: 0,
    conflicts: 0,
    wrongTenant: 0,
    applied: 0,
    rolledBack: 0,
  };
}

export function tallyProposals(proposals: HubspotOwnerMappingProposal[]) {
  const counts = emptyOwnerMappingCounts();
  counts.evaluated = proposals.length;
  for (const p of proposals) {
    if (p.decision === "apply_mapping") counts.proposedApply += 1;
    else if (p.decision === "already_applied") counts.alreadyApplied += 1;
    else if (p.decision === "reject_wrong_tenant") counts.wrongTenant += 1;
    else if (
      p.decision === "conflict_source_mapped_elsewhere" ||
      p.decision === "conflict_target_has_other_owner"
    ) {
      counts.conflicts += 1;
    } else if (
      p.decision === "quarantine_unresolved" ||
      p.decision === "quarantine_inactive_staff" ||
      p.decision === "quarantine_ambiguous" ||
      p.decision === "reject_name_only" ||
      p.decision === "reject_over_limit" ||
      p.decision === "skip_archived_owner"
    ) {
      counts.quarantined += 1;
    }
  }
  return counts;
}

export function failClosedReasonsFromProposals(
  proposals: HubspotOwnerMappingProposal[],
  mode: "preview" | "apply"
): string[] {
  const reasons: string[] = [];
  for (const p of proposals) {
    if (mode === "apply" && p.decision === "apply_mapping") continue;
    if (
      p.decision === "quarantine_ambiguous" ||
      p.decision === "conflict_source_mapped_elsewhere" ||
      p.decision === "conflict_target_has_other_owner" ||
      p.decision === "reject_wrong_tenant" ||
      p.decision === "quarantine_inactive_staff" ||
      p.decision === "reject_over_limit"
    ) {
      // For apply of a selected subset, these on non-selected owners are fine.
      // Caller passes only the selected apply set for fail-closed on apply.
      if (mode === "apply") {
        reasons.push(`${p.hubspotOwnerIdHash}:${p.decision}:${p.reasonCode}`);
      }
    }
  }
  return reasons;
}
