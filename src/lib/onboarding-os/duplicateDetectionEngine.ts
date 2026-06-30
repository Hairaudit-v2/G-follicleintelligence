/**
 * OnboardingOS Phase F5 — duplicate detection for staged connector imports (pure; no server-only).
 * Checks fi_persons, fi_crm_leads, fi_patients, fi_cases with confidence scoring.
 */

import { normalizeEmail, normalizeWhitespaceName } from "@/src/lib/fi/foundation/normalize";

export type DuplicateMatchEntityType = "person" | "lead" | "patient" | "case" | "external_mapping";

export type DuplicateMatchRule = "exact_email" | "exact_phone" | "external_mapping" | "fuzzy_name";

export type DuplicateMatch = {
  entityType: DuplicateMatchEntityType;
  entityId: string;
  rule: DuplicateMatchRule;
  confidence: number;
  label: string;
  detail?: Record<string, unknown>;
};

export type DuplicateCheckInput = {
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
  externalId?: string | null;
  externalEntityType?: string | null;
};

export type DuplicateCheckCandidateIndex = {
  persons: readonly {
    id: string;
    emailNormalized: string | null;
    phoneDigits: string | null;
    displayNameNormalized: string | null;
  }[];
  leads: readonly {
    id: string;
    personId: string;
    summary: string | null;
    emailNormalized: string | null;
  }[];
  patients: readonly {
    id: string;
    personId: string;
    emailNormalized: string | null;
  }[];
  cases: readonly {
    id: string;
    email: string | null;
    fullName: string | null;
    emailNormalized: string | null;
    displayNameNormalized: string | null;
  }[];
  externalMappings: readonly {
    externalId: string;
    sourceEntityType: string;
    fiEntityType: string;
    fiEntityId: string;
  }[];
};

export type DuplicateCheckResult = {
  matches: DuplicateMatch[];
  confidenceScore: number;
  highestConfidence: number;
  hasBlockingMatch: boolean;
  summary: string;
};

function digitsOnly(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const d = phone.replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

/** Token overlap ratio for fuzzy name similarity (0–1). */
function nameSimilarityRatio(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizeWhitespaceName(a);
  const nb = normalizeWhitespaceName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  if (!tokensA.size || !tokensB.size) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap += 1;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function fuzzyNameConfidence(ratio: number): number {
  if (ratio >= 1) return 85;
  if (ratio >= 0.75) return 70;
  if (ratio >= 0.5) return 55;
  return 0;
}

/**
 * Run duplicate detection against in-memory FI indexes.
 * Server layer loads candidates from DB and passes them here.
 */
export function runDuplicateDetection(
  input: DuplicateCheckInput,
  index: DuplicateCheckCandidateIndex
): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const email = normalizeEmail(input.email);
  const phoneDigits = digitsOnly(input.phone);
  const displayNorm = normalizeWhitespaceName(input.displayName);
  const externalId = input.externalId?.trim() ?? null;
  const externalEntityType = input.externalEntityType?.trim() ?? null;

  if (externalId && externalEntityType) {
    for (const m of index.externalMappings) {
      if (m.externalId === externalId && m.sourceEntityType === externalEntityType) {
        matches.push({
          entityType: "external_mapping",
          entityId: m.fiEntityId,
          rule: "external_mapping",
          confidence: 100,
          label: `Already mapped to FI ${m.fiEntityType}`,
          detail: { fiEntityType: m.fiEntityType },
        });
      }
    }
  }

  if (email) {
    for (const p of index.persons) {
      if (p.emailNormalized === email) {
        matches.push({
          entityType: "person",
          entityId: p.id,
          rule: "exact_email",
          confidence: 95,
          label: "Exact email match on fi_persons",
        });
      }
    }
    for (const l of index.leads) {
      if (l.emailNormalized === email) {
        matches.push({
          entityType: "lead",
          entityId: l.id,
          rule: "exact_email",
          confidence: 90,
          label: "Exact email match on fi_crm_leads",
        });
      }
    }
    for (const pat of index.patients) {
      if (pat.emailNormalized === email) {
        matches.push({
          entityType: "patient",
          entityId: pat.id,
          rule: "exact_email",
          confidence: 90,
          label: "Exact email match on fi_patients",
        });
      }
    }
    for (const c of index.cases) {
      if (c.emailNormalized === email || normalizeEmail(c.email) === email) {
        matches.push({
          entityType: "case",
          entityId: c.id,
          rule: "exact_email",
          confidence: 88,
          label: "Exact email match on fi_cases",
        });
      }
    }
  }

  if (phoneDigits) {
    for (const p of index.persons) {
      if (p.phoneDigits === phoneDigits) {
        matches.push({
          entityType: "person",
          entityId: p.id,
          rule: "exact_phone",
          confidence: 85,
          label: "Exact phone match on fi_persons",
        });
      }
    }
  }

  if (displayNorm) {
    for (const p of index.persons) {
      const ratio = nameSimilarityRatio(displayNorm, p.displayNameNormalized);
      const conf = fuzzyNameConfidence(ratio);
      if (conf >= 55) {
        matches.push({
          entityType: "person",
          entityId: p.id,
          rule: "fuzzy_name",
          confidence: conf,
          label: `Fuzzy name match on fi_persons (${Math.round(ratio * 100)}%)`,
          detail: { similarityRatio: ratio },
        });
      }
    }
    for (const c of index.cases) {
      const ratio = nameSimilarityRatio(displayNorm, c.displayNameNormalized ?? c.fullName);
      const conf = fuzzyNameConfidence(ratio);
      if (conf >= 55) {
        matches.push({
          entityType: "case",
          entityId: c.id,
          rule: "fuzzy_name",
          confidence: conf,
          label: `Fuzzy name match on fi_cases (${Math.round(ratio * 100)}%)`,
          detail: { similarityRatio: ratio },
        });
      }
    }
    for (const l of index.leads) {
      const ratio = nameSimilarityRatio(displayNorm, l.summary);
      const conf = fuzzyNameConfidence(ratio);
      if (conf >= 55) {
        matches.push({
          entityType: "lead",
          entityId: l.id,
          rule: "fuzzy_name",
          confidence: conf,
          label: `Fuzzy name match on fi_crm_leads (${Math.round(ratio * 100)}%)`,
          detail: { similarityRatio: ratio },
        });
      }
    }
  }

  const deduped = dedupeMatches(matches);
  const highestConfidence = deduped.length ? Math.max(...deduped.map((m) => m.confidence)) : 0;
  const hasBlockingMatch = deduped.some(
    (m) => m.confidence >= 95 && (m.rule === "exact_email" || m.rule === "external_mapping")
  );

  const confidenceScore = highestConfidence;

  let summary: string;
  if (!deduped.length) {
    summary = "No duplicate matches — safe to create new FI records.";
  } else if (hasBlockingMatch) {
    summary = `High-confidence duplicate detected (${highestConfidence}%) — review before import or merge with existing.`;
  } else {
    summary = `Possible duplicates found (confidence up to ${highestConfidence}%) — review recommended.`;
  }

  return {
    matches: deduped,
    confidenceScore,
    highestConfidence,
    hasBlockingMatch,
    summary,
  };
}

function dedupeMatches(matches: DuplicateMatch[]): DuplicateMatch[] {
  const seen = new Map<string, DuplicateMatch>();
  for (const m of matches) {
    const key = `${m.entityType}:${m.entityId}:${m.rule}`;
    const existing = seen.get(key);
    if (!existing || m.confidence > existing.confidence) {
      seen.set(key, m);
    }
  }
  return [...seen.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Extract person index fields from fi_persons metadata row. */
export function personRowToDuplicateCandidate(row: {
  id: string;
  metadata: unknown;
}): DuplicateCheckCandidateIndex["persons"][number] {
  const m = row.metadata as Record<string, unknown> | null;
  const emailNormalized =
    typeof m?.email_normalized === "string" ? normalizeEmail(m.email_normalized) : null;
  const phoneRaw = typeof m?.phone === "string" ? m.phone : null;
  const hub = m?.hubspot as Record<string, unknown> | undefined;
  const hubPhone = typeof hub?.phone_number === "string" ? hub.phone_number : null;
  const displayNameNormalized =
    typeof m?.normalised_display_name === "string"
      ? m.normalised_display_name
      : normalizeWhitespaceName(typeof m?.display_name === "string" ? m.display_name : null);
  return {
    id: row.id,
    emailNormalized,
    phoneDigits: digitsOnly(phoneRaw ?? hubPhone),
    displayNameNormalized,
  };
}

/** Extract case index fields from fi_cases row. */
export function caseRowToDuplicateCandidate(row: {
  id: string;
  email: string | null;
  full_name: string | null;
}): DuplicateCheckCandidateIndex["cases"][number] {
  const emailNorm = normalizeEmail(row.email);
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    emailNormalized: emailNorm,
    displayNameNormalized: normalizeWhitespaceName(row.full_name),
  };
}
