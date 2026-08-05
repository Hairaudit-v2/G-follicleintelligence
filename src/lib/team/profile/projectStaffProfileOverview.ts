/**
 * Pure profile composition: identity + domain projections → StaffProfileHubModel overview fields.
 * Also adapts hub → legacy StaffProfileOverviewModel for UI parity (B1.6 compat).
 */

import type { StaffAccessEntry } from "@/src/lib/team/access/types";
import type { StaffComplianceEntry } from "@/src/lib/team/compliance/types";
import { projectStaffDirectoryEntry } from "@/src/lib/team/directory";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type { StaffOnboardingEntry } from "@/src/lib/team/onboarding/types";
import type { RosterStaffEntry } from "@/src/lib/team/roster/types";
import { deriveStaffProfileActionFlags } from "@/src/lib/team/profile/staffProfileActionFlags";
import { deriveStaffProfileAttentionReasons } from "@/src/lib/team/profile/staffProfileAttentionReasons";
import type {
  StaffProfileHubModel,
  StaffProfileOverviewSummary,
} from "@/src/lib/team/profile/types";
import type { StaffWorkforceIntelligence } from "@/src/lib/staff/workforceCommandCentre";
import type { OnboardingChecklistState } from "@/src/lib/workforce/onboarding/onboardingTypes";
import type { StaffAuthLoginStatus, StaffInviteStatus } from "@/src/lib/workforce/staffAccessCentreCore";
import {
  buildStaffProfileOverviewModel,
  type StaffProfileAccessSnapshot,
  type StaffProfileIdentityAuditSnapshot,
  type StaffProfileLeaveContext,
  type StaffProfileOverviewModel,
} from "@/src/lib/workforce/staffProfileHubCore";

export function projectStaffProfileOverviewSummary(
  identity: StaffIdentity,
  onboarding: StaffOnboardingEntry | null
): StaffProfileOverviewSummary {
  return {
    displayName: identity.displayName,
    employmentStatus: identity.employmentStatus,
    accessStatus: identity.accessStatus,
    onboardingStatus: onboarding?.onboardingStatus ?? null,
    readinessStatus: identity.readinessStatus,
    primaryClinicId: identity.primaryClinicId,
    clinicIds: identity.clinicIds,
  };
}

export function composeStaffProfileHubModel(input: {
  identity: StaffIdentity;
  access: StaffAccessEntry | null;
  onboarding: StaffOnboardingEntry | null;
  roster: RosterStaffEntry | null;
  compliance: StaffComplianceEntry | null;
  hrefs?: {
    identityAudit?: string | null;
    access?: string | null;
    onboarding?: string | null;
    roster?: string | null;
    compliance?: string | null;
  };
}): StaffProfileHubModel {
  const directory = projectStaffDirectoryEntry(input.identity);

  return {
    identity: input.identity,
    overview: projectStaffProfileOverviewSummary(input.identity, input.onboarding),
    directory,
    access: input.access,
    onboarding: input.onboarding,
    roster: input.roster,
    compliance: input.compliance,
    attentionReasons: deriveStaffProfileAttentionReasons({
      identity: input.identity,
      access: input.access,
      onboarding: input.onboarding,
      roster: input.roster,
      compliance: input.compliance,
      hrefs: input.hrefs,
    }),
    actions: deriveStaffProfileActionFlags(input.identity),
  };
}

function mapAccessEntryToAuthLogin(access: StaffAccessEntry | null): StaffAuthLoginStatus | null {
  if (!access) return null;
  if (access.accessStatus === "active") return "login_active";
  if (access.accessStatus === "invite_pending") return "invite_pending";
  if (access.accessStatus === "suspended") return "suspended";
  if (access.accessStatus === "revoked") return "revoked";
  return "no_login";
}

function mapIdentityToAuditSnapshot(
  identity: StaffIdentity,
  onboarding: StaffOnboardingEntry | null,
  pinStatus: string | null
): StaffProfileIdentityAuditSnapshot {
  const { linkStatus } = identity.integrity;
  const workspaceProfileStatus =
    linkStatus === "linked"
      ? "ready"
      : linkStatus === "ambiguous"
        ? "ambiguous"
        : linkStatus === "scheduling_only" || linkStatus === "lifecycle_only"
          ? "missing"
          : "unknown";

  return {
    workspaceProfileStatus,
    loginStatus: identity.accessStatus,
    pinStatus: pinStatus ?? "unknown",
    onboardingStatus: onboarding?.onboardingStatus ?? "unknown",
    issues: identity.integrity.warnings.map((w) => w.message),
  };
}

function accessSnapshotFromDomains(input: {
  access: StaffAccessEntry | null;
  pinStatus: string | null;
  inviteStatus: StaffInviteStatus | null;
}): StaffProfileAccessSnapshot | null {
  if (!input.access) return null;
  return {
    authLoginStatus: mapAccessEntryToAuthLogin(input.access) ?? "no_login",
    inviteStatus: input.inviteStatus ?? "none",
    pinStatus: input.pinStatus ?? "Not set",
    canSendInvite: input.access.canInvite,
    canResendInvite: input.access.canResend,
    canCopyInviteLink: false,
    canResetPin: false,
    canSuspendAccess: input.access.canSuspend,
    canRevokeAccess: input.access.canRevoke,
  };
}

/**
 * Map composed hub + presentation supplements → existing overview DTO for UI parity.
 * Action / status policy values come from domain projections; intel/leave remain label supplements.
 */
export function toStaffProfileOverviewModel(input: {
  profile: StaffProfileHubModel;
  tenantId: string;
  checklist: OnboardingChecklistState;
  pinStatus?: string | null;
  loginInviteStatus?: StaffInviteStatus | null;
  canCopyLoginInviteLink?: boolean;
  canResetPin?: boolean;
  systemAccessRevoked: boolean;
  workforceIntelligence?: StaffWorkforceIntelligence | null;
  leaveContext?: StaffProfileLeaveContext | null;
  viewerCanManageAccess?: boolean;
  viewerCanManageOnboarding?: boolean;
  viewerCanManageReadiness?: boolean;
  viewerCanViewIdentityAudit?: boolean;
}): StaffProfileOverviewModel {
  const { profile } = input;
  const staffMemberId = profile.identity.staffMemberId ?? "";
  const onboardingInviteStatus = profile.onboarding?.onboardingInvite.status ?? "none";
  const hasOnboardingInviteUrl = Boolean(
    profile.onboarding?.actions.canCopyOnboardingInviteLink
  );

  const accessRow = accessSnapshotFromDomains({
    access: profile.access,
    pinStatus: input.pinStatus ?? null,
    inviteStatus: input.loginInviteStatus ?? null,
  });

  if (accessRow) {
    accessRow.canCopyInviteLink = Boolean(input.canCopyLoginInviteLink);
    accessRow.canResetPin = Boolean(input.canResetPin);
  }

  return {
    ...buildStaffProfileOverviewModel({
      tenantId: input.tenantId,
      staffMemberId,
      fiStaffId: profile.identity.staffId,
      staffName: profile.overview.displayName,
      employmentStatus: profile.overview.employmentStatus,
      archivedAt: profile.identity.archivedAt,
      email: profile.identity.email,
      systemAccessRevoked: input.systemAccessRevoked,
      onboardingInviteStatus,
      hasOnboardingInviteUrl,
      checklist: input.checklist,
      accessRow,
      workforceIntelligence: input.workforceIntelligence ?? null,
      identityAuditRow: mapIdentityToAuditSnapshot(
        profile.identity,
        profile.onboarding,
        input.pinStatus ?? null
      ),
      pinStatus: input.pinStatus ?? null,
      viewerCanManageAccess: input.viewerCanManageAccess,
      viewerCanManageOnboarding: input.viewerCanManageOnboarding,
      viewerCanManageReadiness: input.viewerCanManageReadiness,
      viewerCanViewIdentityAudit: input.viewerCanViewIdentityAudit,
      leaveContext: input.leaveContext ?? null,
    }),
    domainActions: {
      access: profile.access
        ? {
            canInvite: profile.access.canInvite,
            canResend: profile.access.canResend,
            canSuspend: profile.access.canSuspend,
            canRevoke: profile.access.canRevoke,
          }
        : undefined,
      onboarding: profile.onboarding?.actions,
      compliance: profile.compliance?.actions,
      identity: profile.actions.identity,
    },
  };
}
