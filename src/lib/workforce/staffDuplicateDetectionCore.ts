/**
 * Pure duplicate detection scoring (no I/O). WorkforceOS Phase 1C Sprint 1.
 */

import {
  fuzzyNameSimilarity,
  normalizeEmail,
  normalizeName,
  type StaffMemberSnapshot,
} from "@/src/lib/workforce/identityReconciliationCore";

export const DUPLICATE_CANDIDATE_THRESHOLD = 80;

export type DuplicatePairSignals = {
  matchEmail: boolean;
  matchName: boolean;
  matchPhone: boolean;
  roleSimilarity: boolean;
  externalIdConflict: boolean;
};

export type DuplicateCandidateScore = {
  staffAId: string;
  staffBId: string;
  similarityScore: number;
  signals: DuplicatePairSignals;
};

/** Canonical pair ordering: smaller UUID first. */
export function sortStaffPairId(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function scoreDuplicatePair(
  a: StaffMemberSnapshot,
  b: StaffMemberSnapshot
): DuplicateCandidateScore | null {
  if (a.id === b.id) return null;
  if (a.mergedInto || b.mergedInto) return null;
  if (a.archivedAt || b.archivedAt) return null;

  const [staffAId, staffBId] = sortStaffPairId(a.id, b.id);

  let score = 0;
  const signals: DuplicatePairSignals = {
    matchEmail: false,
    matchName: false,
    matchPhone: false,
    roleSimilarity: false,
    externalIdConflict: false,
  };

  const emailA = normalizeEmail(a.email);
  const emailB = normalizeEmail(b.email);
  if (emailA && emailB && emailA === emailB) {
    score = Math.max(score, 100);
    signals.matchEmail = true;
  }

  const phoneA = a.phone?.trim();
  const phoneB = b.phone?.trim();
  if (phoneA && phoneB && phoneA === phoneB) {
    score = Math.max(score, 90);
    signals.matchPhone = true;
  }

  const nameA = normalizeName(a.fullName);
  const nameB = normalizeName(b.fullName);
  if (nameA && nameB) {
    if (nameA === nameB) {
      score = Math.max(score, 75);
      signals.matchName = true;
    } else {
      const fuzzy = fuzzyNameSimilarity(a.fullName, b.fullName);
      if (fuzzy >= 0.92) {
        score = Math.max(score, 60);
        signals.matchName = true;
      }
    }
  }

  const roleA = a.roleCode?.trim().toLowerCase();
  const roleB = b.roleCode?.trim().toLowerCase();
  if (roleA && roleB && roleA === roleB) {
    score += 10;
    signals.roleSimilarity = true;
  }

  if (
    a.sourceExternalId &&
    b.sourceExternalId &&
    a.sourceExternalId === b.sourceExternalId
  ) {
    score += 100;
    signals.externalIdConflict = true;
  }

  if (score < DUPLICATE_CANDIDATE_THRESHOLD) return null;

  return { staffAId, staffBId, similarityScore: score, signals };
}

export function detectDuplicateCandidatesForMembers(
  members: StaffMemberSnapshot[]
): DuplicateCandidateScore[] {
  const active = members.filter((m) => !m.archivedAt && !m.mergedInto);
  const seen = new Set<string>();
  const out: DuplicateCandidateScore[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const scored = scoreDuplicatePair(active[i]!, active[j]!);
      if (!scored) continue;
      const key = `${scored.staffAId}:${scored.staffBId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(scored);
    }
  }

  return out.sort((x, y) => y.similarityScore - x.similarityScore);
}