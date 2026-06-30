import type { HieConsultationConsentComplexityLevel, HieConsultationPriorityLevel } from "./types";
import {
  HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS,
  HIE_CONSULTATION_PRIORITY_LEVELS,
} from "./types";

export type ConsultationChecklistAnalyticsRow = {
  priority_level: string;
  delay_recommended: boolean;
  expectation_management_required: boolean;
  medication_discussion_required: boolean;
  consent_complexity_level: string | null;
  risk_flags: string[];
};

function normPriority(p: string): HieConsultationPriorityLevel {
  return (HIE_CONSULTATION_PRIORITY_LEVELS as readonly string[]).includes(p)
    ? (p as HieConsultationPriorityLevel)
    : "low";
}

function normConsent(
  c: string | null | undefined
): HieConsultationConsentComplexityLevel | "unset" {
  if (c == null || c === "") return "unset";
  return (HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS as readonly string[]).includes(c)
    ? (c as HieConsultationConsentComplexityLevel)
    : "unknown";
}

/** Counts rows per priority_level (invalid values bucketed as low). */
export function consultationChecklistPriorityDistribution(
  rows: ConsultationChecklistAnalyticsRow[]
): Record<HieConsultationPriorityLevel, number> {
  const init: Record<HieConsultationPriorityLevel, number> = {
    low: 0,
    moderate: 0,
    high: 0,
    urgent: 0,
  };
  for (const r of rows) {
    const k = normPriority(r.priority_level);
    init[k] += 1;
  }
  return init;
}

export function consultationChecklistDelayRecommendationRate(
  rows: ConsultationChecklistAnalyticsRow[]
): number {
  if (rows.length === 0) return 0;
  const n = rows.filter((r) => r.delay_recommended).length;
  return n / rows.length;
}

export function consultationChecklistExpectationManagementRate(
  rows: ConsultationChecklistAnalyticsRow[]
): number {
  if (rows.length === 0) return 0;
  const n = rows.filter((r) => r.expectation_management_required).length;
  return n / rows.length;
}

export function consultationChecklistMedicationDiscussionRate(
  rows: ConsultationChecklistAnalyticsRow[]
): number {
  if (rows.length === 0) return 0;
  const n = rows.filter((r) => r.medication_discussion_required).length;
  return n / rows.length;
}

/** Consent complexity histogram including unset (null/empty). */
export function consultationChecklistConsentComplexityDistribution(
  rows: ConsultationChecklistAnalyticsRow[]
): Record<HieConsultationConsentComplexityLevel | "unset", number> {
  const keys = [...HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS, "unset"] as const;
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<
    HieConsultationConsentComplexityLevel | "unset",
    number
  >;
  for (const r of rows) {
    const k = normConsent(r.consent_complexity_level);
    out[k] += 1;
  }
  return out;
}

/** Frequency of individual risk flag strings across rows. */
export function consultationChecklistRiskFlagFrequency(
  rows: ConsultationChecklistAnalyticsRow[]
): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const r of rows) {
    for (const raw of r.risk_flags) {
      const f = typeof raw === "string" ? raw.trim() : "";
      if (!f) continue;
      freq[f] = (freq[f] ?? 0) + 1;
    }
  }
  return freq;
}
