/**
 * Pure identity reconciliation helpers (no I/O). Used by WorkforceOS Phase 1C Sprint 1.
 */

export type StaffMemberSnapshot = {
  id: string;
  tenantId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roleCode: string | null;
  fiStaffId: string | null;
  sourceExternalId: string | null;
  iiohrStaffRecordId?: string | null;
  sourceSystem?: string | null;
  mergedInto: string | null;
  archivedAt: string | null;
};

export type IdentityLinkSnapshot = {
  staffMemberId: string;
  sourceSystem: string;
  externalId: string;
  externalEmail: string | null;
  externalName: string | null;
};

export type InboundStaffIdentity = {
  sourceSystem: string;
  externalId: string;
  email: string | null;
  fullName: string;
  phone?: string | null;
  roleCode?: string | null;
};

export type StaffIdentityMatchMethod =
  | "existing_identity_link"
  | "email_exact"
  | "name_exact"
  | "name_fuzzy"
  | "none"
  | "manual_review";

export type StaffIdentityMatchResult = {
  staffMemberId: string | null;
  matchMethod: StaffIdentityMatchMethod;
  confidence: number;
  requiresManualReview: boolean;
  conflictReason: string | null;
};

const FUZZY_NAME_THRESHOLD = 0.92;

/** Lowercase, trim, strip common punctuation for email comparison. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (email == null) return null;
  const t = email.trim().toLowerCase();
  return t || null;
}

/** Collapse whitespace, lowercase, strip punctuation for name comparison. */
export function normalizeName(name: string | null | undefined): string | null {
  if (name == null) return null;
  const t = name
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t || null;
}

function tokenSet(name: string): Set<string> {
  return new Set(name.split(" ").filter(Boolean));
}

/** Jaccard similarity on name tokens (0–1). */
export function fuzzyNameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = tokenSet(na);
  const tb = tokenSet(nb);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const tok of ta) {
    if (tb.has(tok)) inter += 1;
  }
  const union = ta.size + tb.size - inter;
  return union > 0 ? inter / union : 0;
}

export function calculateStaffIdentityMatchScore(
  existingStaff: StaffMemberSnapshot,
  inboundStaff: InboundStaffIdentity
): number {
  let score = 0;
  const inboundEmail = normalizeEmail(inboundStaff.email);
  const existingEmail = normalizeEmail(existingStaff.email);
  if (inboundEmail && existingEmail && inboundEmail === existingEmail) score = Math.max(score, 100);

  const inboundName = normalizeName(inboundStaff.fullName);
  const existingName = normalizeName(existingStaff.fullName);
  if (inboundName && existingName) {
    if (inboundName === existingName) score = Math.max(score, 75);
    else {
      const fuzzy = fuzzyNameSimilarity(inboundStaff.fullName, existingStaff.fullName);
      if (fuzzy >= FUZZY_NAME_THRESHOLD) score = Math.max(score, 60);
    }
  }

  const inboundPhone = inboundStaff.phone?.trim();
  const existingPhone = existingStaff.phone?.trim();
  if (inboundPhone && existingPhone && inboundPhone === existingPhone) {
    score = Math.max(score, 90);
  }

  const inboundRole = inboundStaff.roleCode?.trim().toLowerCase();
  const existingRole = existingStaff.roleCode?.trim().toLowerCase();
  if (inboundRole && existingRole && inboundRole === existingRole) score += 10;

  if (
    existingStaff.sourceExternalId &&
    inboundStaff.externalId &&
    existingStaff.sourceExternalId === inboundStaff.externalId
  ) {
    score += 100;
  }

  return score;
}

function isActiveMember(m: StaffMemberSnapshot): boolean {
  return !m.archivedAt && !m.mergedInto;
}

export function findExistingStaffMatch(input: {
  tenantId: string;
  sourceSystem: string;
  externalId: string;
  email: string | null;
  fullName: string;
  staffMembers: StaffMemberSnapshot[];
  identityLinks: IdentityLinkSnapshot[];
}): StaffIdentityMatchResult {
  const ext = input.externalId.trim();
  const sys = input.sourceSystem.trim();
  const inboundEmail = normalizeEmail(input.email);
  const inboundName = normalizeName(input.fullName);

  const activeMembers = input.staffMembers.filter(
    (m) => m.tenantId === input.tenantId && isActiveMember(m)
  );

  const link = input.identityLinks.find(
    (l) => l.sourceSystem === sys && l.externalId === ext
  );
  if (link) {
    return {
      staffMemberId: link.staffMemberId,
      matchMethod: "existing_identity_link",
      confidence: 1,
      requiresManualReview: false,
      conflictReason: null,
    };
  }

  if (inboundEmail) {
    const emailMatches = activeMembers.filter(
      (m) => normalizeEmail(m.email) === inboundEmail
    );
    if (emailMatches.length === 1) {
      return {
        staffMemberId: emailMatches[0]!.id,
        matchMethod: "email_exact",
        confidence: 1,
        requiresManualReview: false,
        conflictReason: null,
      };
    }
    if (emailMatches.length > 1) {
      return {
        staffMemberId: null,
        matchMethod: "manual_review",
        confidence: 0.5,
        requiresManualReview: true,
        conflictReason: "Multiple staff members share the inbound email.",
      };
    }
  }

  if (inboundName) {
    const nameMatches = activeMembers.filter(
      (m) => normalizeName(m.fullName) === inboundName
    );
    if (nameMatches.length === 1) {
      const match = nameMatches[0]!;
      const existingEmail = normalizeEmail(match.email);
      if (inboundEmail && existingEmail && inboundEmail !== existingEmail) {
        return {
          staffMemberId: match.id,
          matchMethod: "manual_review",
          confidence: 0.6,
          requiresManualReview: true,
          conflictReason: "Name matches but email differs.",
        };
      }
      return {
        staffMemberId: match.id,
        matchMethod: "name_exact",
        confidence: 0.85,
        requiresManualReview: false,
        conflictReason: null,
      };
    }

    if (!inboundEmail) {
      const fuzzyMatches = activeMembers.filter((m) => {
        const sim = fuzzyNameSimilarity(m.fullName, input.fullName);
        return sim >= FUZZY_NAME_THRESHOLD;
      });
      if (fuzzyMatches.length === 1) {
        return {
          staffMemberId: fuzzyMatches[0]!.id,
          matchMethod: "name_fuzzy",
          confidence: 0.75,
          requiresManualReview: false,
          conflictReason: null,
        };
      }
    }
  }

  return {
    staffMemberId: null,
    matchMethod: "none",
    confidence: 0,
    requiresManualReview: false,
    conflictReason: null,
  };
}

export type ReconcileInboundStaffIdentityResult = StaffIdentityMatchResult & {
  shouldCreate: boolean;
  shouldUpdate: boolean;
};

export function reconcileInboundStaffIdentity(input: {
  tenantId: string;
  inbound: InboundStaffIdentity;
  staffMembers: StaffMemberSnapshot[];
  identityLinks: IdentityLinkSnapshot[];
}): ReconcileInboundStaffIdentityResult {
  const match = findExistingStaffMatch({
    tenantId: input.tenantId,
    sourceSystem: input.inbound.sourceSystem,
    externalId: input.inbound.externalId,
    email: input.inbound.email,
    fullName: input.inbound.fullName,
    staffMembers: input.staffMembers,
    identityLinks: input.identityLinks,
  });

  if (match.requiresManualReview) {
    return { ...match, shouldCreate: false, shouldUpdate: false };
  }

  if (match.staffMemberId) {
    return { ...match, shouldCreate: false, shouldUpdate: true };
  }

  return { ...match, shouldCreate: true, shouldUpdate: false };
}