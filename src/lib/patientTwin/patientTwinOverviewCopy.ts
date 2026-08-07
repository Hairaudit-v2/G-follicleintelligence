/**
 * FI-DEMO-DAY-2A.4 — Staff-facing copy helpers for empty / future states.
 * Never invent clinical findings; keep chrome free of prohibited brands.
 */

import { FI_OS_STAFF_TERMS } from "@/src/lib/fiOs/ux/fiOsStaffTerminology";
import type { OverviewAvailability, OutcomeEvidenceKind } from "./patientTwinOverviewTypes";

export const OVERVIEW_SECTION_HEADINGS = {
  summary: "Patient summary",
  baseline: "Baseline",
  surgicalPlan: "Surgical plan",
  procedure: "Procedure",
  outcomes: "Outcomes",
  workforce: "Team on procedure day",
  economics: FI_OS_STAFF_TERMS.money,
  governance: "Governance",
} as const;

/** Demo Day pitch brands that must never appear in overview UI chrome. */
export const OVERVIEW_PROHIBITED_BRAND_PATTERNS: readonly RegExp[] = [
  /\bLeadFlow\b/i,
  /\bHairIntel\b/i,
  /\bAuditOS\b/i,
  /\bAcademyOS\b/i,
  /\bClinicOS\b/i,
  /\bAnalyticsOS\b/i,
  /\bDigital\s+Twin\b/i,
  /\bPatient\s+Twin\b/i,
];

export function availabilityLabel(availability: OverviewAvailability): string {
  switch (availability) {
    case "recorded":
      return "Recorded";
    case "not_recorded":
      return "Not recorded";
    case "not_available":
      return "Not available";
    case "not_applicable":
      return "Not applicable";
    case "planned_future":
      return "Planned / future";
  }
}

export function evidenceKindBadge(kind: OutcomeEvidenceKind): string {
  switch (kind) {
    case "observed_clinical":
      return "Observed clinical evidence";
    case "projected_outcome":
      return "Projected outcome";
    case "projected_fixture":
      return "Demonstration projection";
    case "future_dated_fixture":
      return "Future demonstration milestone";
  }
}

export function overviewStaffCopyCorpus(): string[] {
  return [
    FI_OS_STAFF_TERMS.healthRecord,
    OVERVIEW_SECTION_HEADINGS.summary,
    OVERVIEW_SECTION_HEADINGS.baseline,
    OVERVIEW_SECTION_HEADINGS.surgicalPlan,
    OVERVIEW_SECTION_HEADINGS.procedure,
    OVERVIEW_SECTION_HEADINGS.outcomes,
    OVERVIEW_SECTION_HEADINGS.workforce,
    OVERVIEW_SECTION_HEADINGS.economics,
    OVERVIEW_SECTION_HEADINGS.governance,
    "Demo showcase",
    "Read-only",
    availabilityLabel("not_recorded"),
    availabilityLabel("not_available"),
    availabilityLabel("not_applicable"),
    availabilityLabel("planned_future"),
    evidenceKindBadge("projected_fixture"),
    evidenceKindBadge("future_dated_fixture"),
    evidenceKindBadge("observed_clinical"),
    evidenceKindBadge("projected_outcome"),
  ];
}

export function findProhibitedBrandHits(text: string): string[] {
  const hits: string[] = [];
  for (const re of OVERVIEW_PROHIBITED_BRAND_PATTERNS) {
    const m = text.match(re);
    if (m?.[0]) hits.push(m[0]);
  }
  return hits;
}

export function formatAudCents(cents: number, currency = "AUD"): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency === "AUD" ? "AUD" : currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${(amount).toFixed(0)}`;
  }
}

export function formatGraftCount(n: number): string {
  return new Intl.NumberFormat("en-AU").format(n);
}
