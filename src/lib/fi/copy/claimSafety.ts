/**
 * Claim-safe copy layer. Ensures report language remains decision-support.
 * Avoid definitive claims; prefer "may", "risk", "consistent with", "suggests".
 */

/** Phrases that imply definitive medical claims (avoid) */
export const FORBIDDEN_PHRASES = [
  /\bcures?\b/i,
  /\bwill\s+regrow\b/i,
  /\bguaranteed\b/i,
  /\bwill\s+(?:stop|prevent|reverse)\b/i,
  /\bdefinitely\b/i,
  /\bcertainly\b/i,
  /\bproven\s+to\s+(?:cure|regrow|stop|reverse)\b/i,
  /\b(?:always|never)\s+(?:works|effective)\b/i,
  /\b100%\s+(?:effective|guarantee)\b/i,
  /\bpermanent\s+(?:cure|solution|fix)\b/i,
  /\bguaranteed\s+(?:results?|outcome)\b/i,
  /\bpromises?\s+(?:to\s+)?(?:cure|regrow|stop)\b/i,
] as const;

/** Preferred decision-support language (suggest when forbidden found) */
export const PREFERRED_ALTERNATIVES: Record<string, string> = {
  cure: "may support",
  "will regrow": "may support regrowth",
  guaranteed: "associated with",
  "will stop": "may help reduce",
  "will prevent": "may help reduce risk of",
  "will reverse": "may help improve",
  definitely: "suggests",
  certainly: "consistent with",
  "proven to": "associated with",
  "permanent cure": "long-term management",
  "guaranteed results": "potential outcomes",
};

export type ClaimSafetyViolation = {
  phrase: string;
  index: number;
  match: string;
  suggestion?: string;
};

export type ClaimSafetyResult = { ok: true } | { ok: false; violations: ClaimSafetyViolation[] };

/**
 * Validate text for claim-safe language. Use before final report generation.
 */
export function validateClaimSafety(text: string): ClaimSafetyResult {
  if (!text || typeof text !== "string") return { ok: true };

  const violations: ClaimSafetyViolation[] = [];

  for (const pattern of FORBIDDEN_PHRASES) {
    const matches = text.matchAll(new RegExp(pattern.source, "gi"));
    for (const m of matches) {
      const match = m[0];
      const index = m.index ?? 0;
      let suggestion: string | undefined;
      for (const [forbidden, alt] of Object.entries(PREFERRED_ALTERNATIVES)) {
        if (new RegExp(forbidden, "i").test(match)) {
          suggestion = alt;
          break;
        }
      }
      violations.push({
        phrase: pattern.source,
        index,
        match,
        suggestion: suggestion ?? "consider: may, risk, consistent with, suggests",
      });
    }
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true };
}

type LegacyReportPayload = {
  explainability?: Record<string, string[]>;
  imageCaptions?: Array<{ caption?: string }>;
  [k: string]: unknown;
};

type CanonicalReportPayload = {
  disclaimers?: string[];
  score_summary?: {
    risk_tier_summary?: string;
    sections?: Array<{ interpretation?: string }>;
  };
  sections?: Array<{ content?: string }>;
  appendix?: {
    image_findings?: Array<{ caption?: string }>;
  };
  [k: string]: unknown;
};

/**
 * Validate all user-facing text in a report payload.
 * Supports both canonical ReportJson and legacy shape.
 */
export function validateReportCopySafety(
  reportJson: LegacyReportPayload | CanonicalReportPayload
): ClaimSafetyResult {
  const violations: ClaimSafetyViolation[] = [];

  if (reportJson.disclaimers) {
    for (const text of reportJson.disclaimers) {
      const r = validateClaimSafety(text);
      if (!r.ok) violations.push(...r.violations);
    }
  }
  const canonical = reportJson as CanonicalReportPayload;
  if (canonical.score_summary?.risk_tier_summary) {
    const r = validateClaimSafety(canonical.score_summary.risk_tier_summary);
    if (!r.ok) violations.push(...r.violations);
  }
  for (const s of canonical.score_summary?.sections ?? []) {
    if (s.interpretation) {
      const r = validateClaimSafety(s.interpretation);
      if (!r.ok) violations.push(...r.violations);
    }
  }
  for (const s of canonical.sections ?? []) {
    if (s.content) {
      const r = validateClaimSafety(s.content);
      if (!r.ok) violations.push(...r.violations);
    }
  }
  for (const f of canonical.appendix?.image_findings ?? []) {
    if (f.caption) {
      const r = validateClaimSafety(f.caption);
      if (!r.ok) violations.push(...r.violations);
    }
  }

  const legacy = reportJson as LegacyReportPayload;
  if (legacy.explainability) {
    for (const lines of Object.values(legacy.explainability)) {
      for (const line of lines ?? []) {
        const r = validateClaimSafety(line);
        if (!r.ok) violations.push(...r.violations);
      }
    }
  }
  if (legacy.imageCaptions) {
    for (const cap of legacy.imageCaptions) {
      if (cap.caption) {
        const r = validateClaimSafety(cap.caption);
        if (!r.ok) violations.push(...r.violations);
      }
    }
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true };
}
