/**
 * Project one Command Centre person summary from identity + domain projections.
 * Reuses profile attention reasons — does not re-derive domain policy.
 */

import { projectStaffDirectoryEntry } from "@/src/lib/team/directory";
import type { StaffAccessEntry } from "@/src/lib/team/access/types";
import type { StaffComplianceEntry } from "@/src/lib/team/compliance/types";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type { StaffOnboardingEntry } from "@/src/lib/team/onboarding/types";
import { deriveStaffProfileAttentionReasons } from "@/src/lib/team/profile/staffProfileAttentionReasons";
import type { RosterStaffEntry } from "@/src/lib/team/roster/types";
import type {
  CommandCentreDomainHrefs,
  CommandCentrePrimaryAction,
  CommandCentreStaffSummary,
  StaffIdentitySummary,
} from "@/src/lib/team/commandCentre/types";

export function toStaffIdentitySummary(identity: StaffIdentity): StaffIdentitySummary {
  return {
    personKey: identity.personKey,
    staffId: identity.staffId,
    staffMemberId: identity.staffMemberId,
    userId: identity.userId,
    displayName: identity.displayName,
    email: identity.email,
    employmentStatus: identity.employmentStatus,
    accessStatus: identity.accessStatus,
    readinessStatus: identity.readinessStatus,
    archivedAt: identity.archivedAt,
    hrLinked: identity.hrLinked,
    integrity: identity.integrity,
  };
}

function pickPrimaryAction(
  reasons: ReturnType<typeof deriveStaffProfileAttentionReasons>
): CommandCentrePrimaryAction | null {
  const withHref = reasons.find((r) => Boolean(r.href?.trim()));
  if (!withHref?.href) return null;
  return {
    label: withHref.label,
    href: withHref.href,
    source: withHref.source,
  };
}

export function projectCommandCentreStaffSummary(input: {
  identity: StaffIdentity;
  access: StaffAccessEntry | null;
  onboarding: StaffOnboardingEntry | null;
  roster: RosterStaffEntry | null;
  compliance: StaffComplianceEntry | null;
  hrefs: CommandCentreDomainHrefs;
}): CommandCentreStaffSummary {
  const { identity, access, onboarding, roster, compliance, hrefs } = input;
  const directory = projectStaffDirectoryEntry(identity);

  const attentionReasons = deriveStaffProfileAttentionReasons({
    identity,
    access,
    onboarding,
    roster,
    compliance,
    hrefs: {
      identityAudit: hrefs.identityAudit,
      access: hrefs.access,
      onboarding: hrefs.onboarding,
      roster: hrefs.roster,
      compliance: hrefs.compliance,
    },
  });

  return {
    identity: toStaffIdentitySummary(identity),
    directory,
    access,
    onboarding,
    roster,
    compliance,
    readinessStatus: identity.readinessStatus,
    attentionReasons,
    primaryAction: pickPrimaryAction(attentionReasons),
  };
}

/**
 * Deduplicate identities that appear under both staffId and staffMemberId subject keys.
 */
export function dedupeIdentitiesByPersonKey(
  identities: readonly StaffIdentity[]
): StaffIdentity[] {
  const byKey = new Map<string, StaffIdentity>();
  for (const identity of identities) {
    if (!identity.personKey) continue;
    const existing = byKey.get(identity.personKey);
    if (!existing) {
      byKey.set(identity.personKey, identity);
      continue;
    }
    // Prefer the richer linked form when both were resolved.
    const preferIncoming =
      (identity.integrity.linkStatus === "linked" &&
        existing.integrity.linkStatus !== "linked") ||
      (Boolean(identity.staffId) && !existing.staffId) ||
      (Boolean(identity.staffMemberId) && !existing.staffMemberId);
    if (preferIncoming) byKey.set(identity.personKey, identity);
  }
  return [...byKey.values()];
}
