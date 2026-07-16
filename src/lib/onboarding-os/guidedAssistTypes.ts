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
] as const;

export type GuidedAssistEventKind = (typeof GUIDED_ASSIST_EVENT_KINDS)[number];

export type GuidedAssistRoleScope = {
  workspaceProfiles?: readonly FiWorkspaceProfileKey[];
  tenantAdminRoles?: readonly FiTenantAdminRole[];
  /** When true, tip applies to any viewer (still page-scoped). */
  anyRole?: boolean;
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
  priority: number;
  roleScope: GuidedAssistRoleScope;
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
};

export type GuidedAssistNextActionView = {
  code: string;
  area: GuidedAssistArea;
  areaLabel: string;
  title: string;
  description: string;
  href: string;
};

export type GuidedAssistSessionPayload = {
  assistEnabled: boolean;
  isOnboardingPhase: boolean;
  pageKey: string;
  tips: GuidedAssistTipView[];
  nextAction: GuidedAssistNextActionView | null;
  safetyNotice: string;
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
