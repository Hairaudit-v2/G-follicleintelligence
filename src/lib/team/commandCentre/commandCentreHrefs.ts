/**
 * Canonical Team destinations for Command Centre attention / primary actions.
 */

import {
  buildOnboardingCentreHrefForTenant,
  buildStaffAccessCentreHrefForTenant,
  buildStaffDirectoryHref,
  buildStaffIdentityAuditHref,
  buildStaffProfileHref,
  buildWorkforceRosterHref,
} from "@/src/lib/workforce/staffLifecycleCopy";
import type { CommandCentreDomainHrefs } from "@/src/lib/team/commandCentre/types";

export function buildCommandCentreDomainHrefs(tenantId: string): CommandCentreDomainHrefs {
  const tid = tenantId.trim();
  const teamBase = `/fi-admin/${tid}/team`;

  return {
    identityAudit: buildStaffIdentityAuditHref(tid),
    access: buildStaffAccessCentreHrefForTenant(tid),
    onboarding: buildOnboardingCentreHrefForTenant(tid),
    roster: buildWorkforceRosterHref(tid),
    compliance: `${teamBase}/compliance`,
    profileFor: ({ staffId, staffMemberId }) => {
      const id = (staffMemberId ?? staffId)?.trim();
      if (!id) return null;
      return buildStaffProfileHref(tid, id);
    },
  };
}

export function resolveDirectoryIssueHref(
  tenantId: string,
  hrefs: CommandCentreDomainHrefs,
  ids: { staffId: string | null; staffMemberId: string | null }
): string {
  return hrefs.profileFor(ids) ?? buildStaffDirectoryHref(tenantId);
}
