/**
 * OnboardingOS Phase D — Guided Assist Mode types (safe for core unit tests; no server-only).
 */

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

/** FI OS modules covered by deterministic operational guidance (no clinical advice). */
export const GUIDED_ASSIST_AREAS = [
  "reception_os",
  "consultation_os",
  "surgery_os",
  "financial_os",
  "academy_os",
  "workforce_os",
  "analytics_os",
] as const;

export type GuidedAssistArea = (typeof GUIDED_ASSIST_AREAS)[number];

export const GUIDED_ASSIST_EVENT_KINDS = [
  "assist_enabled",
  "assist_disabled",
  "tip_shown",
  "tip_dismissed",
  "tip_snoozed",
  "next_action_clicked",
  "widget_collapsed",
  "widget_expanded",
  "tip_feedback_helpful",
  "tip_feedback_unhelpful",
  "engagement_active",
  "tour_completed",
] as const;

export type GuidedAssistEventKind = (typeof GUIDED_ASSIST_EVENT_KINDS)[number];

/** Weekly progress goal for “tips used this week” summary. */
export const GUIDED_ASSIST_WEEKLY_PROGRESS_GOAL = 5;

export type GuidedAssistRoleScope = {
  workspaceProfiles?: readonly FiWorkspaceProfileKey[];
  tenantAdminRoles?: readonly FiTenantAdminRole[];
  /** When true, tip applies to any viewer (still page-scoped). */
  anyRole?: boolean;
};

/**
 * Simplified Today role tags for role-first tips (first N home visits).
 * Mapped from workspace profile + tenant admin role at runtime.
 */
export const GUIDED_ASSIST_TODAY_ROLE_KEYS = [
  "reception",
  "consultant",
  "finance",
  "doctor",
  "nurse",
  "admin",
  "all",
] as const;

export type GuidedAssistTodayRoleKey = (typeof GUIDED_ASSIST_TODAY_ROLE_KEYS)[number];

/**
 * Tip audience group for prioritisation.
 * - `clinical` — doctors, consultants, nurses, surgeons (patient-flow workflows)
 * - `support` — finance, reception desk depth, team admin helpers
 * - `core` — whole-clinic operational tips (default when omitted)
 */
export const GUIDED_ASSIST_ROLE_GROUPS = ["core", "clinical", "support"] as const;
export type GuidedAssistRoleGroup = (typeof GUIDED_ASSIST_ROLE_GROUPS)[number];

/** Default number of Today page exposures that use role-first tip ordering. */
export const GUIDED_ASSIST_ROLE_FIRST_VIEW_LIMIT = 5;

/** Experience tier for tip tone / depth (operational only). */
export const GUIDED_ASSIST_EXPERIENCE_LEVELS = ["novice", "intermediate", "advanced"] as const;
export type GuidedAssistExperienceLevel = (typeof GUIDED_ASSIST_EXPERIENCE_LEVELS)[number];

/** Days since guide preference row created → still novice when under this (if not overridden). */
export const GUIDED_ASSIST_NOVICE_MAX_DAYS = 30;

/** today_home_views threshold: at/above → advanced when age allows (inferred). */
export const GUIDED_ASSIST_ADVANCED_MIN_VIEWS = 40;

/** today_home_views under this still novice when under novice max days. */
export const GUIDED_ASSIST_NOVICE_MAX_VIEWS = 12;

/** Empty-state tour keys (matched from route + clinic stats). */
export const GUIDED_ASSIST_EMPTY_STATE_KEYS = [
  "pipeline_empty",
  "front_desk_empty",
  "money_empty",
  "surgery_empty",
  "calendar_empty",
] as const;

export type GuidedAssistEmptyStateKey = (typeof GUIDED_ASSIST_EMPTY_STATE_KEYS)[number];

export const GUIDED_ASSIST_TIME_OF_DAY = ["morning", "afternoon", "evening", "any"] as const;
export type GuidedAssistTimeOfDay = (typeof GUIDED_ASSIST_TIME_OF_DAY)[number];

/**
 * Operational conditions from lightweight clinic stats (never clinical).
 * Evaluated in getContextualTips / resolveEmptyStateKey.
 */
export const GUIDED_ASSIST_CONTEXT_CONDITIONS = [
  "zero_leads",
  "open_leads",
  "high_open_leads",
  "zero_today_bookings",
  "today_bookings",
  "open_tasks",
  "zero_payment_records",
  "zero_open_surgery_cases",
] as const;

/** openLeadCount at/above this qualifies as high volume for next-best-action tips. */
export const GUIDED_ASSIST_HIGH_OPEN_LEADS_THRESHOLD = 5;

export type GuidedAssistContextCondition = (typeof GUIDED_ASSIST_CONTEXT_CONDITIONS)[number];

export type GuidedAssistContextTriggers = {
  timeOfDay?: GuidedAssistTimeOfDay;
  condition?: GuidedAssistContextCondition;
};

/** Lightweight operational counts for contextual + empty-state tips (tenant-scoped). */
export type GuidedAssistClinicStats = {
  openLeadCount: number;
  todayBookingCount: number;
  openTaskCount: number;
  openSurgeryCaseCount: number;
  paymentRecordCount: number;
  /** Local clinic hour 0–23 when known; omit for “any”. */
  hourLocal?: number | null;
};

export type GuidedAssistTipDefinition = {
  code: string;
  area: GuidedAssistArea;
  title: string;
  body: string;
  /** Relative path after `/fi-admin/[tenantId]/` or empty for home. */
  pageKey: string;
  /** Optional prefix match — e.g. `consultations/` matches nested consultation routes. */
  pageKeyPrefix?: boolean;
  /**
   * Sort key: **lower number = shown first** (catalog convention).
   * Role-first Today tips use the same convention.
   */
  priority: number;
  roleScope: GuidedAssistRoleScope;
  /**
   * Optional Today role-first tags. When present on a Today (`pageKey === ""`) tip,
   * the tip is eligible for the first-N-logins role-first window.
   */
  roles?: readonly GuidedAssistTodayRoleKey[];
  /**
   * Audience group for prioritisation (clinical staff get clinical tips first).
   * Omit = `core` (whole-clinic).
   */
  roleGroup?: GuidedAssistRoleGroup;
  /**
   * When set, this tip is the **tour root** for an empty state (shows “Tour me”).
   * `tourSteps` lists tip codes for the sequenced walkthrough.
   */
  emptyStateKey?: GuidedAssistEmptyStateKey;
  /** Tip codes for empty-state / onboarding tours (3–5 steps typical). */
  tourSteps?: readonly string[];
  /** Optional time-of-day / stats conditions (operational only). */
  contextTriggers?: GuidedAssistContextTriggers;
  /**
   * When set, tip only shows for these experience tiers.
   * Omit = all tiers.
   */
  experienceLevel?: readonly GuidedAssistExperienceLevel[];
  /**
   * When set, tip is a **Next best action** candidate (rule-based NBA).
   * Lower number = higher priority among NBA tips.
   */
  nextBestActionPriority?: number;
  /** When true, tip is eligible for NBA selection (requires nextBestActionPriority). */
  isNextBestAction?: boolean;
  dismissible: boolean;
  snoozeHours?: number;
  /** Operational CTA — never patient-specific clinical recommendations. */
  actionLabel?: string;
  actionHrefSuffix?: string;
};

export type GuidedAssistNextActionDefinition = {
  code: string;
  area: GuidedAssistArea;
  title: string;
  description: string;
  hrefSuffix: string;
  roleScope: GuidedAssistRoleScope;
  /** Lower = higher priority when multiple actions match. */
  priority: number;
  /** When all are true, this action is eligible. */
  requiresSetupFlags?: Partial<GuidedAssistSetupFlags>;
};

export type GuidedAssistSetupFlags = {
  organisationCreated: boolean;
  clinicCreated: boolean;
  clinicSettingsComplete: boolean;
  firstCaseCreated: boolean;
};

export type GuidedAssistSnoozedTips = Record<string, string>;

export type GuidedAssistTenantDefaults = {
  defaultEnabledDuringOnboarding: boolean;
  defaultAssistEnabled: boolean;
};

export type GuidedAssistUserPreferences = {
  assistEnabled: boolean | null;
  dismissedTipCodes: readonly string[];
  snoozedTips: GuidedAssistSnoozedTips;
  /** Times role-first tips were shown on Today for this user (this tenant). */
  todayHomeViews: number;
  /** Explicit tier override from preferences (null = infer). */
  experienceLevelOverride: GuidedAssistExperienceLevel | null;
  /** ISO timestamp when the user preference row was created (guide age). */
  guideStartedAtIso: string | null;
  /** Consecutive engagement days (from preferences row). */
  engagementStreakDays: number;
  /** Last engagement calendar date YYYY-MM-DD (clinic-local). */
  engagementLastActiveDateYmd: string | null;
};

/** Streak after a touch / for session display. */
export type GuidedAssistStreakState = {
  streakDays: number;
  lastActiveDateYmd: string;
  /** True when DB should be written. */
  updated: boolean;
  message: string | null;
};

export type GuidedAssistProgressSummary = {
  completedCount: number;
  goalCount: number;
  /** e.g. "3/5 clinic tips used this week" */
  label: string;
  isComplete: boolean;
};

export type GuidedAssistTeamHighlight = {
  tipCode: string;
  tipTitle: string;
  useCount: number;
  /** Anonymized aggregate label for admins. */
  label: string;
};

/** Session engagement block (lightweight adoption boosters). */
export type GuidedAssistEngagementSnapshot = {
  streakDays: number;
  streakMessage: string | null;
  progress: GuidedAssistProgressSummary;
  /** Admin-only anonymized clinic highlight. */
  teamHighlight: GuidedAssistTeamHighlight | null;
  /** tip_code → last feedback from this user (null = none yet). */
  feedbackByTipCode: Record<string, boolean | null>;
};

export type GuidedAssistResolvedPreferences = {
  assistEnabled: boolean;
  tenantDefaults: GuidedAssistTenantDefaults;
  userPreferences: GuidedAssistUserPreferences;
  isOnboardingPhase: boolean;
};

export type GuidedAssistViewerContext = {
  tenantId: string;
  pageKey: string;
  workspaceProfileKey: FiWorkspaceProfileKey;
  tenantAdminRole: FiTenantAdminRole | null;
  setupFlags: GuidedAssistSetupFlags;
  isOnboardingPhase: boolean;
};

export type GuidedAssistTipView = {
  code: string;
  area: GuidedAssistArea;
  areaLabel: string;
  title: string;
  body: string;
  dismissible: boolean;
  snoozeHours: number | null;
  actionLabel: string | null;
  actionHref: string | null;
  /** Present on tour-root tips when an empty-state tour is available. */
  emptyStateKey?: GuidedAssistEmptyStateKey | null;
  /** Resolved tour step tip codes (tour root only). */
  tourStepCodes?: readonly string[] | null;
  /** Rule-based or future AI next-best-action tip. */
  isNextBestAction?: boolean;
  /**
   * Source of the tip for UI badges / audit.
   * - `catalog` — standard guide
   * - `rule_nba` — deterministic next-best-action
   * - `ai_nba` — reserved for Edge Function suggestions (not used until enabled)
   */
  suggestionSource?: "catalog" | "rule_nba" | "ai_nba";
};

export type GuidedAssistNextActionView = {
  code: string;
  area: GuidedAssistArea;
  areaLabel: string;
  title: string;
  description: string;
  href: string;
};

export type GuidedAssistEmptyStateTourView = {
  emptyStateKey: GuidedAssistEmptyStateKey;
  rootTipCode: string;
  title: string;
  body: string;
  /** Ordered step tips for the walkthrough. */
  steps: GuidedAssistTipView[];
};

export type GuidedAssistSessionPayload = {
  /**
   * Effective Clinic guide on/off for this user (user override → onboarding default → post-setup default).
   * Stored as `fi_guided_assist_preferences.assist_enabled` (null = inherit).
   */
  assistEnabled: boolean;
  isOnboardingPhase: boolean;
  pageKey: string;
  tips: GuidedAssistTipView[];
  nextAction: GuidedAssistNextActionView | null;
  safetyNotice: string;
  /** True when tips were selected via role-first Today window (first N home views). */
  roleFirstActive: boolean;
  /** Viewer simplified role used for role-first filtering. */
  todayRole: GuidedAssistTodayRoleKey | null;
  /**
   * Friendly, role-aware mode line (e.g. “Doctor Mode — here to help with patient flow today”).
   * Always warm and operational — never clinical advice.
   */
  roleModeLabel: string | null;
  /** Current Today home view count before this exposure (0-based window check). */
  todayHomeViews: number;
  /** N for role-first window (default {@link GUIDED_ASSIST_ROLE_FIRST_VIEW_LIMIT}). */
  roleFirstViewLimit: number;
  /** Client should call increment once when true and assist is enabled. */
  shouldIncrementTodayHomeViews: boolean;
  /** Active empty-state tour offer for this route (Tour me). */
  emptyStateTour: GuidedAssistEmptyStateTourView | null;
  /** Snapshot used for contextual copy (may be zeros if load failed). */
  clinicStats: GuidedAssistClinicStats | null;
  /** Local time band used for contextual tips. */
  timeOfDay: GuidedAssistTimeOfDay | null;
  /** Inferred or overridden experience tier. */
  experienceLevel: GuidedAssistExperienceLevel;
  /** 1–2 next-best-action tips (rule-based; future AI). */
  nextBestActions: GuidedAssistTipView[];
  /**
   * Always show a dock affordance so users can re-enable from the UI
   * (even when assist is off and setup is complete).
   */
  showReenableChrome: boolean;
  /** Settings → Clinic Guide path for this tenant. */
  settingsHref: string;
  /** Explicit per-user preference (null = inheriting tenant defaults). */
  userAssistOverride: boolean | null;
  /** Clinic admin / ops can change tenant defaults + enable-for-all. */
  canManageTenantDefaults: boolean;
  /** Streak, weekly progress, feedback map, optional team highlight. */
  engagement: GuidedAssistEngagementSnapshot;
  /**
   * Admin session force-show (cookie) — tips render even when preference is off.
   * Does not change stored `assist_enabled`.
   */
  forceShowActive: boolean;
  /**
   * Tips/tours should render (preference on **or** force-show).
   * Preference `assistEnabled` may still be false under force-show.
   */
  guideVisible: boolean;
  /** Structured debug fields for admins / `?debug=guide`. */
  debugInfo: GuidedAssistDebugInfo | null;
};

/** Troubleshooting snapshot (Settings + optional widget debug panel). */
export type GuidedAssistDebugInfo = {
  enabled: boolean;
  userAssistOverride: boolean | null;
  forceShowActive: boolean;
  guideVisible: boolean;
  todayHomeViews: number;
  role: GuidedAssistTodayRoleKey;
  roleGroup: GuidedAssistRoleGroup;
  roleMode: string | null;
  experienceLevel: GuidedAssistExperienceLevel;
  clinicSetupComplete: boolean;
  isOnboardingPhase: boolean;
  pageKey: string;
  workspaceProfileKey: string;
  tenantAdminRole: string | null;
  roleFirstActive: boolean;
  tipCount: number;
  nextBestActionCount: number;
};

/** Settings page snapshot (per-user + optional admin controls). */
export type GuidedAssistSettingsState = {
  assistEnabled: boolean;
  userAssistOverride: boolean | null;
  isOnboardingPhase: boolean;
  tenantDefaults: GuidedAssistTenantDefaults;
  canManageTenantDefaults: boolean;
  settingsHref: string;
  staffWithExplicitOff: number;
  staffWithExplicitOn: number;
  /** Session force-show cookie active for this browser. */
  forceShowActive: boolean;
  /** Debug fields (always filled; UI shows to admins or debug query). */
  debugInfo: GuidedAssistDebugInfo;
};

export type GuidedAssistAreaInsight = {
  guidanceArea: GuidedAssistArea;
  tipsShown: number;
  tipsDismissed: number;
  tipsSnoozed: number;
  dismissRate: number;
  needsGuidanceReview: boolean;
};

export type GuidedAssistReliantUser = {
  fiUserId: string;
  email: string | null;
  tipsShown: number;
};

export type GuidedAssistUsageSummary = {
  tenantId: string;
  windowDays: number;
  totalEvents: number;
  uniqueUsers: number;
  assistEnabledUsers: number;
  assistDisabledUsers: number;
  tipsShown: number;
  tipsDismissed: number;
  tipsSnoozed: number;
  nextActionsClicked: number;
  topTips: readonly { guidanceCode: string; count: number }[];
  eventsByArea: readonly { guidanceArea: GuidedAssistArea; count: number }[];
  topReliedTips: readonly { guidanceCode: string; shownCount: number; dismissedCount: number }[];
  topDismissedTips: readonly { guidanceCode: string; count: number }[];
  areaInsights: readonly GuidedAssistAreaInsight[];
  modulesNeedingGuidanceReview: readonly GuidedAssistArea[];
  reliantUsers: readonly GuidedAssistReliantUser[];
};

export const GUIDED_ASSIST_SAFETY_NOTICE =
  "Clinic guide shows operational setup and day-of steps only. It does not give clinical advice or patient-specific treatment recommendations.";

/** Staff-facing area labels (no architecture “OS” names). */
export const GUIDED_ASSIST_AREA_LABELS: Record<GuidedAssistArea, string> = {
  reception_os: "Front desk",
  consultation_os: "Consultations",
  surgery_os: "Surgery",
  financial_os: "Money",
  academy_os: "Training",
  workforce_os: "Team",
  analytics_os: "Reports & setup",
};
