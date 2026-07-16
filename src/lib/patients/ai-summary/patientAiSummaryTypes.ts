/**
 * AI Patient Summary — operational overview only (no clinical advice).
 * Safe for unit tests (no server-only imports).
 */

export const PATIENT_AI_SUMMARY_DISCLAIMER =
  "This is a summary of recorded operational data only — always verify clinically. It does not diagnose, recommend treatment, or interpret medical findings.";

export const PATIENT_AI_SUMMARY_WARM_INTRO =
  "Here’s a clear picture of the patient’s record so far — visits, media, and open operational steps only.";

/** Short TTL cache (minutes). */
export const PATIENT_AI_SUMMARY_CACHE_TTL_MINUTES = 15;

/** Tenant settings metadata key (fi_tenant_settings.metadata). */
export const PATIENT_AI_SUMMARY_TENANT_FLAG = "ai_patient_summary_enabled";

export type PatientAiSummarySource = "llm" | "deterministic" | "cache";

export type PatientAiSummaryOperationalFlag = {
  code: string;
  label: string;
  severity: "info" | "attention";
  hrefSuffix?: string | null;
};

export type PatientAiSummaryTimelineItem = {
  occurredOn: string;
  kind: string;
  label: string;
};

export type PatientAiSummaryQuickLink = {
  label: string;
  href: string;
  code: string;
};

/** Structured summary returned to the UI. */
export type PatientAiSummaryResult = {
  tenantId: string;
  patientId: string;
  generatedAtIso: string;
  source: PatientAiSummarySource;
  model: string | null;
  /** Warm opening line (template-controlled). */
  intro: string;
  overview: string;
  timelineHighlights: readonly PatientAiSummaryTimelineItem[];
  operationalFlags: readonly PatientAiSummaryOperationalFlag[];
  suggestedNextSteps: readonly string[];
  quickLinks: readonly PatientAiSummaryQuickLink[];
  disclaimer: string;
  /** True when safety layer flagged content for human review. */
  requiresHumanReview: boolean;
  safetyNotes: readonly string[];
  cacheHit: boolean;
  expiresAtIso: string | null;
};

/**
 * Operational facts sent to the model (or used deterministically).
 * Never include free-text clinical notes or medication free text.
 */
export type PatientAiSummaryFacts = {
  patientId: string;
  tenantId: string;
  /** Display first name only when available (not full clinical narrative). */
  displayName: string | null;
  patientStatus: string | null;
  recordCreatedOn: string | null;
  imageCount: number;
  hasBaselinePhotos: boolean;
  missingPhotoCategories: readonly string[];
  upcomingAppointmentCount: number;
  nextAppointmentOn: string | null;
  pastAppointmentCount: number;
  openLeadCount: number;
  openCaseCount: number;
  caseStatuses: readonly string[];
  recentActivityKinds: readonly string[];
  timelineItems: readonly PatientAiSummaryTimelineItem[];
  scalesRecordedFlags: readonly string[];
  hasAdminNote: boolean;
  reminderConsent: boolean | null;
};

export type PatientAiSummaryLlmPayload = {
  overview: string;
  timelineHighlights: PatientAiSummaryTimelineItem[];
  operationalFlags: PatientAiSummaryOperationalFlag[];
  suggestedNextSteps: string[];
};

export type PatientAiSummaryGenerateOptions = {
  /** Force refresh past cache. */
  forceRefresh?: boolean;
  /** Prefer deterministic path (tests / no API key). */
  forceDeterministic?: boolean;
};
