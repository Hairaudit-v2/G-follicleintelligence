/**
 * Pure HR reconciliation pipeline helpers (WorkforceOS Phase 1C).
 * Data load → match scoring → duplicate collapse → diagnostics.
 */

import {
  calculateStaffIdentityMatchScore,
  normalizeEmail,
  type IdentityLinkSnapshot,
  type InboundStaffIdentity,
  type StaffMemberSnapshot,
} from "@/src/lib/workforce/identityReconciliationCore";
import { detectDuplicateCandidatesForMembers } from "@/src/lib/workforce/staffDuplicateDetectionCore";

export type ExternalStaffIdentityOption = {
  sourceSystem: string;
  externalId: string;
  externalEmail: string | null;
  externalName: string | null;
};

export type ScoredExternalMatch = ExternalStaffIdentityOption & {
  score: number;
  emailExactMatch: boolean;
  nameMatch: boolean;
};

export type ReconciliationMemberContext = StaffMemberSnapshot & {
  employmentStatus?: string | null;
  iiohrStaffRecordId?: string | null;
};

export type ReconciliationPipelineDiagnostics = {
  totalFiStaff: number;
  activeUnlinkedFiStaff: number;
  totalIiohrExternalRows: number;
  exactEmailCandidatePairs: number;
  linkedFiStaff: number;
  genuinelyUnmatched: number;
  duplicateEmailGroups: number;
  duplicateFiStaffRows: number;
};

const ACTIVE_EMPLOYMENT_STATUSES = new Set([
  "active",
  "pending_onboarding",
  "on_leave",
]);

export function extractEmailFromSourceMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw =
    metadata.email ??
    metadata.work_email ??
    metadata.contact_email ??
    metadata.primary_email;
  return raw != null ? normalizeEmail(String(raw)) : null;
}

export function extractNameFromSourceMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = metadata.full_name ?? metadata.name ?? metadata.display_name;
  if (raw == null) return null;
  const name = String(raw).trim();
  return name || null;
}

export function mergeExternalIdentities(
  identities: ExternalStaffIdentityOption[]
): ExternalStaffIdentityOption[] {
  const byKey = new Map<string, ExternalStaffIdentityOption>();
  for (const identity of identities) {
    const sourceSystem = identity.sourceSystem.trim();
    const externalId = identity.externalId.trim();
    if (!sourceSystem || !externalId) continue;
    const key = `${sourceSystem}:${externalId}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        sourceSystem,
        externalId,
        externalEmail: normalizeEmail(identity.externalEmail),
        externalName: identity.externalName?.trim() || null,
      });
      continue;
    }
    byKey.set(key, {
      ...existing,
      externalEmail: existing.externalEmail ?? normalizeEmail(identity.externalEmail),
      externalName: existing.externalName ?? (identity.externalName?.trim() || null),
    });
  }
  return [...byKey.values()].sort((a, b) =>
    (a.externalName ?? a.externalId).localeCompare(b.externalName ?? b.externalId)
  );
}

export function isActiveEmploymentStatus(status: string | null | undefined): boolean {
  return ACTIVE_EMPLOYMENT_STATUSES.has((status ?? "active").toLowerCase());
}

export function isStaffHrLinked(input: {
  member: ReconciliationMemberContext;
  linkedMemberIds: Set<string>;
}): boolean {
  if (input.member.archivedAt || input.member.mergedInto) return false;
  if (input.linkedMemberIds.has(input.member.id)) return true;
  if (input.member.iiohrStaffRecordId?.trim()) return true;
  return false;
}

export function isActiveUnlinkedStaff(input: {
  member: ReconciliationMemberContext;
  linkedMemberIds: Set<string>;
}): boolean {
  if (!isActiveEmploymentStatus(input.member.employmentStatus)) return false;
  return !isStaffHrLinked(input);
}

export function scoreExternalMatch(
  member: StaffMemberSnapshot,
  external: ExternalStaffIdentityOption
): ScoredExternalMatch {
  const inbound: InboundStaffIdentity = {
    sourceSystem: external.sourceSystem,
    externalId: external.externalId,
    email: external.externalEmail,
    fullName: external.externalName ?? "",
  };
  const score = calculateStaffIdentityMatchScore(member, inbound);
  const memberEmail = normalizeEmail(member.email);
  const externalEmail = normalizeEmail(external.externalEmail);
  const emailExactMatch = Boolean(memberEmail && externalEmail && memberEmail === externalEmail);
  const nameMatch = score >= 75 && !emailExactMatch;
  return {
    ...external,
    score,
    emailExactMatch,
    nameMatch,
  };
}

export function findBestExternalMatch(
  member: StaffMemberSnapshot,
  externals: ExternalStaffIdentityOption[]
): ScoredExternalMatch | null {
  let best: ScoredExternalMatch | null = null;
  for (const external of externals) {
    const scored = scoreExternalMatch(member, external);
    if (!best || scored.score > best.score) {
      best = scored;
    }
  }
  if (!best || best.score < 1) return null;
  return best;
}

export function pickCanonicalMemberForEmailGroup(
  members: ReconciliationMemberContext[]
): string {
  const sorted = [...members].sort((a, b) => {
    if (a.fiStaffId && !b.fiStaffId) return -1;
    if (!a.fiStaffId && b.fiStaffId) return 1;
    if (a.sourceExternalId && !b.sourceExternalId) return -1;
    if (!a.sourceExternalId && b.sourceExternalId) return 1;
    if (a.iiohrStaffRecordId && !b.iiohrStaffRecordId) return -1;
    if (!a.iiohrStaffRecordId && b.iiohrStaffRecordId) return 1;
    return a.id.localeCompare(b.id);
  });
  return sorted[0]!.id;
}

export type DuplicateStaffContext = {
  canonicalStaffMemberId: string;
  duplicateStaffMemberId: string;
};

export function buildDuplicateStaffContexts(
  members: ReconciliationMemberContext[]
): Map<string, DuplicateStaffContext> {
  const duplicateMap = new Map<string, DuplicateStaffContext>();
  const candidates = detectDuplicateCandidatesForMembers(members);
  const memberById = new Map(members.map((m) => [m.id, m]));

  for (const candidate of candidates) {
    if (!candidate.signals.matchEmail) continue;
    const memberA = memberById.get(candidate.staffAId);
    const memberB = memberById.get(candidate.staffBId);
    if (!memberA || !memberB) continue;
    const canonicalId = pickCanonicalMemberForEmailGroup([memberA, memberB]);
    const duplicateId = canonicalId === memberA.id ? memberB.id : memberA.id;
    duplicateMap.set(duplicateId, {
      canonicalStaffMemberId: canonicalId,
      duplicateStaffMemberId: duplicateId,
    });
  }

  return duplicateMap;
}

export function buildReconciliationDiagnostics(input: {
  members: ReconciliationMemberContext[];
  externals: ExternalStaffIdentityOption[];
  linkedMemberIds: Set<string>;
  unlinkedMembers: ReconciliationMemberContext[];
  duplicateContexts: Map<string, DuplicateStaffContext>;
}): ReconciliationPipelineDiagnostics {
  let exactEmailCandidatePairs = 0;
  let genuinelyUnmatched = 0;

  for (const member of input.unlinkedMembers) {
    const best = findBestExternalMatch(member, input.externals);
    if (best?.emailExactMatch) {
      exactEmailCandidatePairs += 1;
      continue;
    }
    if (!best || best.score < 60) {
      genuinelyUnmatched += 1;
    }
  }

  const duplicateEmailGroups = new Set(
    [...input.duplicateContexts.values()].map((d) => d.canonicalStaffMemberId)
  ).size;

  return {
    totalFiStaff: input.members.length,
    activeUnlinkedFiStaff: input.unlinkedMembers.length,
    totalIiohrExternalRows: input.externals.length,
    exactEmailCandidatePairs,
    linkedFiStaff: input.members.filter((m) =>
      isStaffHrLinked({ member: m, linkedMemberIds: input.linkedMemberIds })
    ).length,
    genuinelyUnmatched,
    duplicateEmailGroups,
    duplicateFiStaffRows: input.duplicateContexts.size,
  };
}

export function buildLinkedMemberIdSet(identityLinks: IdentityLinkSnapshot[]): Set<string> {
  return new Set(identityLinks.map((l) => l.staffMemberId));
}

export function buildLinkedExternalKeySet(identityLinks: IdentityLinkSnapshot[]): Set<string> {
  return new Set(identityLinks.map((l) => `${l.sourceSystem}:${l.externalId}`));
}