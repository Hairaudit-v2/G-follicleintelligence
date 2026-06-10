/**
 * AnalyticsOS MVP — presentation types for a tenant-scoped executive dashboard.
 * Metrics are composed from existing module loaders only (no new DB reads here).
 *
 * Payload shapes are aggregate-only (no row-level CRM/patient/audit identifiers or labels)
 * so the dashboard view does not carry PII in its serialized RSC props.
 */

export type AnalyticsOsModuleSnapshot<T> =
  | { state: "ok"; data: T }
  | { state: "limited"; error?: string };

export type AnalyticsOsModuleHealthStatus = "healthy" | "attention" | "limited_data";

export type AnalyticsOsModuleHealthCard = {
  moduleId: "clinicos" | "leadflow" | "patientos" | "surgeryos" | "auditos" | "foundationos";
  label: string;
  href: string;
  linkDisabled?: boolean;
  status: AnalyticsOsModuleHealthStatus;
  primaryMetric: string;
  detail?: string;
};

export type AnalyticsOsRiskRow = {
  rank: number;
  label: string;
  count: number;
  href: string;
  linkDisabled?: boolean;
};

/** Mirrors `TenantQuickStats` — counts / ratios only. */
export type AnalyticsOsQuickStatsPublic = {
  newLeadsThisWeek: number;
  newLeadsToday: number;
  conversionRateLast30d: number | null;
  conversionWonLast30d: number;
  conversionClosedLast30d: number;
  openConsultations: number;
  todaysNoShows: number;
  staffOnDutyToday: number;
};

/** Operational dashboard fields used on AnalyticsOS (no booking rows, lead titles, or reminder PII). */
export type AnalyticsOsOperationalPublic = {
  tenantName: string;
  agendaByBucketCounts: { consult: number; surgery: number; follow_up: number; other: number };
  upcomingRemindersCount: number;
  tasksDueCount: number;
  staleLeadsCount: number;
  staleLeadThresholdDays: number;
  quickStats: AnalyticsOsQuickStatsPublic;
  launchControl: {
    consultationsToday: number;
    surgeriesThisWeek: number;
    leadsNeedingFollowUp: number;
    openTasks: number;
    revenueAvailable: boolean;
  };
};

export type AnalyticsOsPatientKpisPublic = {
  totalPatients: number;
  recentlyAddedPatients: number;
  patientsWithActiveCases: number;
  patientsWithUpcomingBookings: number;
  patientsNeedingFollowUp: number;
};

export type AnalyticsOsPatientPublic = {
  kpis: AnalyticsOsPatientKpisPublic;
};

export type AnalyticsOsSurgeryMetricsPublic = {
  totalActiveCases: number;
  upcomingSurgeries: number;
  readinessReviewCases: number;
  followUpsDueCases: number;
  incompletePlanningCases: number;
};

export type AnalyticsOsSurgeryPublic = {
  todayYmd: string;
  metrics: AnalyticsOsSurgeryMetricsPublic;
  todaySurgeriesCount: number;
  recentCompletedCount: number;
};

export type AnalyticsOsAuditKpisPublic = {
  draft_reports: number;
  changes_required_reports: number;
  released_reports: number;
  pending_reviews: number;
  oldest_queue_created_at: string | null;
};

export type AnalyticsOsAuditPublic = {
  kpis: AnalyticsOsAuditKpisPublic;
};

/** Foundation aggregates used on this page (excludes integrity previews that may hold normalized emails). */
export type AnalyticsOsFoundationPublic = {
  twin_health: {
    foundation_patients: number;
    persons: number;
    cases_total: number;
    cases_with_foundation_patient: number;
    cases_missing_foundation_patient: number;
    patients_with_timeline_events_distinct: number;
    patients_with_unified_media_distinct: number;
    patients_with_crm_lead_distinct: number;
    patients_with_audit_case_distinct: number;
    reports_total: number;
  };
  twin_coverage: {
    timeline_coverage_pct: number;
    media_coverage_pct: number | null;
    crm_coverage_pct: number;
    audit_case_coverage_pct: number | null;
    surgeryos_linkage_pct: number;
    identity_global_resolution_pct: number | null;
    twin_readiness_score_hint: number;
  };
  scan_notes: string[];
};

export type AnalyticsOsDashboardPayload = {
  tenantId: string;
  /** Tenant display name when ClinicOS operational snapshot loaded. */
  tenantName: string | null;
  showCrmNav: boolean;
  showBookingsBoard: boolean;

  operational: AnalyticsOsModuleSnapshot<AnalyticsOsOperationalPublic>;
  patient: AnalyticsOsModuleSnapshot<AnalyticsOsPatientPublic>;
  surgery: AnalyticsOsModuleSnapshot<AnalyticsOsSurgeryPublic>;
  audit: AnalyticsOsModuleSnapshot<AnalyticsOsAuditPublic>;
  foundation: AnalyticsOsModuleSnapshot<AnalyticsOsFoundationPublic>;

  /** Human-readable capture of partial loader failures (no stack traces). */
  loadNotes: string[];

  moduleHealth: AnalyticsOsModuleHealthCard[];
  riskRows: AnalyticsOsRiskRow[];
};
