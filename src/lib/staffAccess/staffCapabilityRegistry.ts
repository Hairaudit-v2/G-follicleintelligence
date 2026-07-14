/**
 * D6G-G0B — Staff capability keys mapped to SA-1 workforce_os tab grants.
 *
 * Capabilities are granted via explicit {@link fi_staff_access_grants} tab rows —
 * never by inflating the base role template or fi_users.role.
 */

import type { StaffAccessLevel, StaffAccessModuleKey } from "./staffAccessRegistry";

/** SA-1 tab_key values for workforce_os (stored in fi_staff_access_grants.tab_key). */
export const WORKFORCE_OS_TAB_KEYS = [
  "roster",
  "standard_hours",
  "identity",
  "onboarding",
  "compliance",
  "training",
] as const;

export type WorkforceOsTabKey = (typeof WORKFORCE_OS_TAB_KEYS)[number];

/** Human-facing capability identifiers (audit + policy). */
export const STAFF_CAPABILITY_KEYS = [
  "roster.view",
  "roster.manage",
  "roster.standard_hours.manage",
  "team.identity.manage",
  "team.onboarding.manage",
  "team.compliance.manage",
  "team.training.manage",
] as const;

export type StaffCapabilityKey = (typeof STAFF_CAPABILITY_KEYS)[number];

export type StaffCapabilitySpec = {
  capability: StaffCapabilityKey;
  module: StaffAccessModuleKey;
  tabKey: WorkforceOsTabKey;
  requiredLevel: StaffAccessLevel;
  label: string;
  description: string;
};

/** Workforce tabs that require an explicit tab grant (never module-read inheritance). */
export const WORKFORCE_SENSITIVE_TAB_KEYS = new Set<WorkforceOsTabKey>([
  "identity",
  "onboarding",
  "compliance",
  "training",
]);

export const STAFF_CAPABILITY_SPECS: Record<StaffCapabilityKey, StaffCapabilitySpec> = {
  "roster.view": {
    capability: "roster.view",
    module: "workforce_os",
    tabKey: "roster",
    requiredLevel: "read",
    label: "Roster view",
    description: "View roster planning without mutating shifts.",
  },
  "roster.manage": {
    capability: "roster.manage",
    module: "workforce_os",
    tabKey: "roster",
    requiredLevel: "edit",
    label: "Roster manage",
    description: "Create, edit, and cancel roster shifts.",
  },
  "roster.standard_hours.manage": {
    capability: "roster.standard_hours.manage",
    module: "workforce_os",
    tabKey: "standard_hours",
    requiredLevel: "edit",
    label: "Standard hours manage",
    description: "Edit staff standard hours templates.",
  },
  "team.identity.manage": {
    capability: "team.identity.manage",
    module: "workforce_os",
    tabKey: "identity",
    requiredLevel: "edit",
    label: "Identity & access manage",
    description: "Manage staff identity and access centre.",
  },
  "team.onboarding.manage": {
    capability: "team.onboarding.manage",
    module: "workforce_os",
    tabKey: "onboarding",
    requiredLevel: "edit",
    label: "Onboarding manage",
    description: "Approve and manage staff onboarding.",
  },
  "team.compliance.manage": {
    capability: "team.compliance.manage",
    module: "workforce_os",
    tabKey: "compliance",
    requiredLevel: "edit",
    label: "Compliance manage",
    description: "Manage compliance documents and records.",
  },
  "team.training.manage": {
    capability: "team.training.manage",
    module: "workforce_os",
    tabKey: "training",
    requiredLevel: "edit",
    label: "Training manage",
    description: "Assign training and SOP sign-offs.",
  },
};

/** Map consolidated Team workspace tab ids to SA-1 tab keys. */
export const TEAM_TAB_ID_TO_WORKFORCE_TAB_KEY: Record<string, WorkforceOsTabKey | null> = {
  overview: null,
  staff: null,
  roster: "roster",
  onboarding: "onboarding",
  compliance: "compliance",
  training: "training",
  identity: "identity",
};

export function isStaffCapabilityKey(v: unknown): v is StaffCapabilityKey {
  return typeof v === "string" && (STAFF_CAPABILITY_KEYS as readonly string[]).includes(v);
}

export function isWorkforceOsTabKey(v: unknown): v is WorkforceOsTabKey {
  return typeof v === "string" && (WORKFORCE_OS_TAB_KEYS as readonly string[]).includes(v);
}
