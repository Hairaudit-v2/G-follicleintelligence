/**
 * WorkforceOS staff lifecycle — user-facing labels and navigation hrefs.
 * Pure module: no server or database imports.
 */

import { buildRosterCommandCentreHref } from "@/src/lib/workforce-os/workforceRosterQueryParams";
import {
  buildStaffAccessCentreHref,
  buildStaffOnboardingCentreHref,
} from "@/src/lib/workforce/staffLifecycleUxCore";

export type StaffLifecycleNavLink = {
  id: string;
  label: string;
  href: string;
  helper?: string;
};

export const STAFF_LIFECYCLE_LABELS = {
  workforce: "Workforce",
  workforceCommandCentre: "Workforce Command Centre",
  commandCentreShort: "Command Centre",
  staffDirectory: "Staff Directory",
  staffAccess: "Staff Access",
  staffAccessCentre: "Staff Access Centre",
  onboardingCentre: "Onboarding Centre",
  identityAudit: "Identity Audit",
  roster: "Roster",
  staffEntitlements: "Staff entitlements",
  hrOsDashboard: "HR dashboard",
} as const;

export const STAFF_LIFECYCLE_HELPERS = {
  identityAudit:
    "Check whether staff identity, login, PIN, and readiness records are linked correctly.",
  roster: "Schedule staff, assign clinical events, and manage shifts and availability.",
  staffEntitlements:
    "Module and field grants by role — separate from login, invite, and PIN provisioning.",
} as const;

function tenantAdminBase(tenantId: string): string {
  return `/fi-admin/${tenantId.trim()}`;
}

export function buildWorkforceCommandCentreHref(tenantId: string): string {
  return `${tenantAdminBase(tenantId)}/workforce-os`;
}

export function buildStaffDirectoryHref(tenantId: string): string {
  return `${tenantAdminBase(tenantId)}/staff`;
}

export function buildStaffIdentityAuditHref(tenantId: string): string {
  return `${tenantAdminBase(tenantId)}/workforce-os/staff-identity-audit`;
}

export function buildWorkforceRosterHref(tenantId: string): string {
  return buildRosterCommandCentreHref({ tenantId });
}

export function buildStaffAccessCentreHrefForTenant(tenantId: string): string {
  return buildStaffAccessCentreHref(tenantAdminBase(tenantId));
}

export function buildOnboardingCentreHrefForTenant(tenantId: string): string {
  return buildStaffOnboardingCentreHref(tenantAdminBase(tenantId));
}

export function buildStaffEntitlementsHref(tenantId: string): string {
  return `${tenantAdminBase(tenantId)}/settings/staff-access`;
}

/** Canonical lifecycle destinations for nav integrity tests. */
export function buildStaffLifecycleNavIntegrityLinks(tenantId: string): StaffLifecycleNavLink[] {
  return [
    {
      id: "workforce_command_centre",
      label: STAFF_LIFECYCLE_LABELS.workforceCommandCentre,
      href: buildWorkforceCommandCentreHref(tenantId),
    },
    {
      id: "staff_directory",
      label: STAFF_LIFECYCLE_LABELS.staffDirectory,
      href: buildStaffDirectoryHref(tenantId),
    },
    {
      id: "staff_access_centre",
      label: STAFF_LIFECYCLE_LABELS.staffAccessCentre,
      href: buildStaffAccessCentreHrefForTenant(tenantId),
    },
    {
      id: "onboarding_centre",
      label: STAFF_LIFECYCLE_LABELS.onboardingCentre,
      href: buildOnboardingCentreHrefForTenant(tenantId),
    },
    {
      id: "identity_audit",
      label: STAFF_LIFECYCLE_LABELS.identityAudit,
      href: buildStaffIdentityAuditHref(tenantId),
      helper: STAFF_LIFECYCLE_HELPERS.identityAudit,
    },
    {
      id: "roster",
      label: STAFF_LIFECYCLE_LABELS.roster,
      href: buildWorkforceRosterHref(tenantId),
      helper: STAFF_LIFECYCLE_HELPERS.roster,
    },
    {
      id: "staff_entitlements",
      label: STAFF_LIFECYCLE_LABELS.staffEntitlements,
      href: buildStaffEntitlementsHref(tenantId),
      helper: STAFF_LIFECYCLE_HELPERS.staffEntitlements,
    },
  ];
}
