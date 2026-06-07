/**
 * FoundationOS dashboard — read-only aggregates for tenant foundation health.
 * Composed from integrity metrics plus supplemental tenant-scoped counts (no PII payloads).
 */

import type { FoundationIntegrityMetrics } from "./integrity";

export type FoundationOsTwinHealthKpis = {
  foundation_patients: number;
  persons: number;
  cases_total: number;
  cases_with_foundation_patient: number;
  cases_missing_foundation_patient: number;
  patients_with_timeline_events_distinct: number;
  patients_with_unified_media_distinct: number;
  patients_with_crm_lead_distinct: number;
  patients_with_audit_case_distinct: number;
  /** fi_reports rows in tenant (proxy for audit pipeline surface area). */
  reports_total: number;
};

export type FoundationOsIdentityResolution = {
  resolution_rows_with_foundation: number;
  resolution_rows_global_only: number;
  resolution_rows_foundation_only_no_global: number;
  duplicate_person_email_groups: number;
  duplicate_patient_rows_same_person_id: number;
};

export type FoundationOsMediaHealth = {
  fi_uploads: number;
  fi_media_assets: number;
  unified_media_rows: number | null;
  unified_media_without_case: number;
  fi_media_assets_without_case_id: number;
  /** Unified view rows with no foundation_patient_id (legacy-only rows or unlinked assets). */
  unified_rows_without_patient: number | null;
};

export type FoundationOsTimelineEventHealth = {
  fi_events: number;
  fi_events_processed: number;
  fi_events_last_7_days: number;
  fi_timeline_events: number;
  timeline_events_with_patient_id: number;
  timeline_events_with_empty_detail_sample: number;
  events_with_fi_case_link: number;
  events_with_foundation_patient_on_linked_case: number;
  events_with_person_on_linked_foundation_patient: number;
};

export type FoundationOsTwinCoverage = {
  /** Approximate % of foundation patients appearing on at least one timeline row (capped scan). */
  timeline_coverage_pct: number;
  /**
   * Approximate % of foundation patients with unified media (capped scan).
   * `null` when the unified view scan was skipped — do not treat as 0%.
   */
  media_coverage_pct: number | null;
  /** Approximate % of foundation patients linked from CRM leads (capped scan). */
  crm_coverage_pct: number;
  /**
   * Approximate % of foundation patients reachable via a case that has a report (capped scan).
   * `null` when the audit linkage query failed — do not treat as 0%.
   */
  audit_case_coverage_pct: number | null;
  /** Cases with foundation_patient_id / max(cases,1). */
  surgeryos_linkage_pct: number;
  /**
   * Share of v_fi_patient_resolution rows with a global stub that also have a foundation patient.
   * `null` when there are no global rows in the view (not the same as “100% resolved”).
   */
  identity_global_resolution_pct: number | null;
  /**
   * Mean of the coverage signals above that are numbers (excludes `null` so failed/skipped scans do not pull the hint to zero).
   * Not the per-patient Patient Twin completeness score.
   */
  twin_readiness_score_hint: number;
};

export type FoundationOsDashboardPayload = {
  tenant_id: string;
  integrity: FoundationIntegrityMetrics;
  twin_health: FoundationOsTwinHealthKpis;
  identity: FoundationOsIdentityResolution;
  media: FoundationOsMediaHealth;
  timeline_events: FoundationOsTimelineEventHealth;
  twin_coverage: FoundationOsTwinCoverage;
  /** Human-readable caveats for capped scans or skipped views. */
  scan_notes: string[];
};
