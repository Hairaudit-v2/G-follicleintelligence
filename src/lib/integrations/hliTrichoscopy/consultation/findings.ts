/**
 * FI-TRICHOSCOPY-1B — finding normalisation from evidence-pack payloads.
 */

import {
  TRICHOSCOPY_FINDING_DOMAINS,
  type NormalisedTrichoscopyFinding,
  type TrichoscopyFindingDomain,
} from "./types";

const ESCALATION_CODES = new Set([
  "urgent_medical_review_recommended",
  "biopsy_consideration",
  "pathology_investigation_recommended",
  "treatment_contraindication_concern",
  "possible_scarring_process",
  "evidence_insufficient_for_conclusion",
]);

const SIGNIFICANT_DOMAINS = new Set<TrichoscopyFindingDomain>([
  "hair_follicular",
  "scalp_inflammatory",
  "distribution_pattern",
  "donor",
  "interpretation",
  "safety_escalation",
]);

function asDomain(value: unknown): TrichoscopyFindingDomain {
  const raw = String(value ?? "other").trim();
  if ((TRICHOSCOPY_FINDING_DOMAINS as readonly string[]).includes(raw)) {
    return raw as TrichoscopyFindingDomain;
  }
  const aliases: Record<string, TrichoscopyFindingDomain> = {
    evidence: "evidence_quality",
    quality: "evidence_quality",
    hair: "hair_follicular",
    follicular: "hair_follicular",
    scalp: "scalp_inflammatory",
    inflammatory: "scalp_inflammatory",
    pattern: "distribution_pattern",
    distribution: "distribution_pattern",
    safety: "safety_escalation",
    escalation: "safety_escalation",
    limitation: "limitation",
    limitations: "limitation",
  };
  return aliases[raw.toLowerCase()] ?? "other";
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function mapOneFinding(raw: Record<string, unknown>): NormalisedTrichoscopyFinding | null {
  const findingCode = String(raw.findingCode ?? raw.finding_code ?? raw.code ?? "").trim();
  if (!findingCode) return null;

  const domain = asDomain(raw.findingDomain ?? raw.finding_domain ?? raw.domain);
  const isEscalation =
    Boolean(raw.isEscalation ?? raw.is_escalation) ||
    domain === "safety_escalation" ||
    ESCALATION_CODES.has(findingCode);

  const isSignificant =
    Boolean(raw.isSignificant ?? raw.is_significant) ||
    isEscalation ||
    SIGNIFICANT_DOMAINS.has(domain);

  return {
    findingDomain: domain,
    findingCode,
    observedRegion: raw.observedRegion
      ? String(raw.observedRegion)
      : raw.observed_region
        ? String(raw.observed_region)
        : raw.region
          ? String(raw.region)
          : null,
    severity: raw.severity ? String(raw.severity) : null,
    extent: raw.extent ? String(raw.extent) : null,
    confidence: toNumberOrNull(raw.confidence),
    evidenceQuality: raw.evidenceQuality
      ? String(raw.evidenceQuality)
      : raw.evidence_quality
        ? String(raw.evidence_quality)
        : null,
    supportingEvidenceRefs: Array.isArray(raw.supportingEvidenceRefs)
      ? raw.supportingEvidenceRefs
      : Array.isArray(raw.supporting_evidence_refs)
        ? raw.supporting_evidence_refs
        : [],
    alternativeInterpretations: Array.isArray(raw.alternativeInterpretations)
      ? raw.alternativeInterpretations
      : Array.isArray(raw.alternative_interpretations)
        ? raw.alternative_interpretations
        : [],
    limitations: Array.isArray(raw.limitations)
      ? raw.limitations.map(String)
      : [],
    recommendedNextStep: raw.recommendedNextStep
      ? String(raw.recommendedNextStep)
      : raw.recommended_next_step
        ? String(raw.recommended_next_step)
        : null,
    isSignificant,
    isEscalation,
    hliFindingId: raw.hliFindingId
      ? String(raw.hliFindingId)
      : raw.hli_finding_id
        ? String(raw.hli_finding_id)
        : raw.id
          ? String(raw.id)
          : null,
    rawPayload: raw,
  };
}

/**
 * Normalise structured findings from an evidence-pack payload or findings_summary.
 * Never invents diagnoses; only maps observations.
 */
export function normaliseTrichoscopyFindingsFromPack(payload: unknown): NormalisedTrichoscopyFinding[] {
  if (!payload || typeof payload !== "object") return [];

  const root = payload as Record<string, unknown>;
  const candidates: unknown[] = [];

  if (Array.isArray(root.findings)) candidates.push(...root.findings);
  if (Array.isArray(root.structuredFindings)) candidates.push(...root.structuredFindings);
  if (Array.isArray(root.structured_findings)) candidates.push(...root.structured_findings);

  const summary = root.findingsSummary ?? root.findings_summary;
  if (summary && typeof summary === "object" && !Array.isArray(summary)) {
    const s = summary as Record<string, unknown>;
    if (Array.isArray(s.items)) candidates.push(...s.items);
    if (Array.isArray(s.findings)) candidates.push(...s.findings);
    // Flatten domain buckets when provided as objects of arrays / codes
    for (const [key, value] of Object.entries(s)) {
      if (key === "stub" || key === "items" || key === "findings") continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") {
            candidates.push({ findingCode: item, findingDomain: key });
          } else if (item && typeof item === "object") {
            candidates.push({ ...(item as object), findingDomain: (item as { findingDomain?: string }).findingDomain ?? key });
          }
        }
      } else if (typeof value === "string" && value.trim()) {
        candidates.push({ findingCode: value, findingDomain: key });
      } else if (value === true) {
        candidates.push({ findingCode: key, findingDomain: key });
      }
    }
  }

  if (Array.isArray(root.escalations)) {
    for (const e of root.escalations) {
      candidates.push({
        findingCode: String(e),
        findingDomain: "safety_escalation",
        isEscalation: true,
        isSignificant: true,
      });
    }
  }

  if (Array.isArray(root.limitations)) {
    for (const lim of root.limitations) {
      candidates.push({
        findingCode: String(lim),
        findingDomain: "limitation",
        isSignificant: false,
      });
    }
  }

  const out: NormalisedTrichoscopyFinding[] = [];
  const seen = new Set<string>();
  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    const mapped = mapOneFinding(item as Record<string, unknown>);
    if (!mapped) continue;
    const key = `${mapped.findingCode}:${mapped.observedRegion ?? "-"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapped);
  }
  return out;
}

export function groupFindingsByDomain(
  findings: NormalisedTrichoscopyFinding[]
): Record<TrichoscopyFindingDomain, NormalisedTrichoscopyFinding[]> {
  const groups = Object.fromEntries(
    TRICHOSCOPY_FINDING_DOMAINS.map((d) => [d, [] as NormalisedTrichoscopyFinding[]])
  ) as Record<TrichoscopyFindingDomain, NormalisedTrichoscopyFinding[]>;

  for (const f of findings) {
    groups[f.findingDomain].push(f);
  }
  return groups;
}
