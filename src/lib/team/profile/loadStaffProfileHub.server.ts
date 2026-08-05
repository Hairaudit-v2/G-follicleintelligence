/**
 * Staff Profile Hub loader (FI-TEAM-COHESION-B1.6).
 *
 * Query budget (per request):
 * 1. One `resolveStaffIdentity` (discriminated by staffId | staffMemberId)
 * 2. Parallel domain fact loads (shared identity — no per-domain re-resolve):
 *    - access centre row for member (preresolved identity)
 *    - onboarding checklist + invite
 *    - credentials (lifecycle subjects)
 *    - optional scheduling presentation (leave + command-centre labels) when gate allows
 * 3. In-memory projection + composition
 *
 * Profile does not re-derive access / onboarding / roster / compliance policy.
 */

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";
import { loadHrNotificationByStaffId } from "@/src/lib/staff/staffHrNotificationLoader.server";
import { loadWorkforceCommandCentreIntelligence } from "@/src/lib/staff/workforceCommandCentre.server";
import { projectStaffAccessEntry } from "@/src/lib/team/access";
import { projectStaffComplianceEntry } from "@/src/lib/team/compliance";
import {
  IdentityCrossTenantError,
  resolveStaffIdentity,
} from "@/src/lib/team/identity/server";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { STAFF_IDENTITY_UNUSABLE_LINK_STATUSES } from "@/src/lib/team/identity/constants";
import {
  projectStaffOnboardingEntry,
} from "@/src/lib/team/onboarding";
import { composeStaffProfileHubModel } from "@/src/lib/team/profile/projectStaffProfileOverview";
import type {
  LoadStaffProfileHubInput,
  LoadStaffProfileHubResult,
  StaffProfileHubModel,
} from "@/src/lib/team/profile/types";
import { projectRosterStaffEntry } from "@/src/lib/team/roster";
import {
  buildOnboardingCentreHrefForTenant,
  buildStaffAccessCentreHrefForTenant,
  buildStaffIdentityAuditHref,
  buildWorkforceRosterHref,
} from "@/src/lib/workforce/staffLifecycleCopy";
import {
  canCopyOnboardingInviteLink,
  canResendOnboardingInvite,
  canSendOnboardingInvite,
  mapOnboardingInviteDisplayStatus,
} from "@/src/lib/workforce/onboarding/onboardingCentreCore";
import { loadOnboardingChecklist } from "@/src/lib/workforce/onboarding/onboardingChecklist.server";
import {
  loadStaffAccessCentreRowForMember,
  type StaffAccessCentreRow,
} from "@/src/lib/team/access/server";
import { loadStaffCredentials } from "@/src/lib/workforce/staffCredentials.server";
import { loadStaffLeaveContext } from "@/src/lib/workforce/staffLeaveWorkflow.server";
import type { StaffProfileLeaveContext } from "@/src/lib/workforce/staffProfileHubCore";
import type { StaffWorkforceIntelligence } from "@/src/lib/staff/workforceCommandCentre";

export type LoadStaffProfileHubOptions = {
  canManage?: boolean;
  /** When false, return cross_tenant rejection instead of throwing. Default true. */
  throwOnCrossTenant?: boolean;
};

export type StaffProfileHubLoadBundle = {
  profile: StaffProfileHubModel;
  /** Presentation supplements for legacy overview adapter — not policy authorities. */
  supplements: {
    accessRow: StaffAccessCentreRow | null;
    checklist: Awaited<ReturnType<typeof loadOnboardingChecklist>> | null;
    workforceIntelligence: StaffWorkforceIntelligence | null;
    leaveContext: StaffProfileLeaveContext | null;
    systemAccessRevoked: boolean;
  };
};

async function loadOnboardingInviteFacts(
  tenantId: string,
  staffMemberId: string
): Promise<{
  id: string | null;
  status: "none" | "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string | null;
  hasInviteUrl: boolean;
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const mid = assertNonEmptyUuid(staffMemberId, "staffMemberId");
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_staff_onboarding_invitations")
    .select("id, status, expires_at, accepted_at, invite_token")
    .eq("tenant_id", tid)
    .eq("staff_member_id", mid)
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!data) {
    return { id: null, status: "none", expiresAt: null, hasInviteUrl: false };
  }

  const raw = data as {
    id: string;
    status: string;
    expires_at: string;
    accepted_at: string | null;
    invite_token: string | null;
  };

  const status = mapOnboardingInviteDisplayStatus({
    rawStatus: raw.status,
    expiresAt: raw.expires_at,
    acceptedAt: raw.accepted_at,
  });

  const token = raw.invite_token?.trim() ?? "";
  const hasInviteUrl = Boolean(token) && (status === "pending" || status === "expired");

  return {
    id: String(raw.id),
    status,
    expiresAt: raw.expires_at,
    hasInviteUrl,
  };
}

function mayUseSchedulingProjection(identity: StaffIdentity): boolean {
  return (
    !STAFF_IDENTITY_UNUSABLE_LINK_STATUSES.has(identity.integrity.linkStatus) &&
    Boolean(identity.staffId)
  );
}

/**
 * Resolve identity through the discriminated contract and compose domain projections.
 */
export async function loadStaffProfileHub(
  input: LoadStaffProfileHubInput,
  options?: LoadStaffProfileHubOptions
): Promise<LoadStaffProfileHubResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const canManage = options?.canManage ?? false;
  const throwOnCrossTenant = options?.throwOnCrossTenant !== false;

  let identity: StaffIdentity | null;
  try {
    identity = await resolveStaffIdentity(
      input.by === "staffId"
        ? { tenantId: tid, by: "staffId", staffId: assertNonEmptyUuid(input.staffId, "staffId") }
        : {
            tenantId: tid,
            by: "staffMemberId",
            staffMemberId: assertNonEmptyUuid(input.staffMemberId, "staffMemberId"),
          },
      { throwOnCrossTenant }
    );
  } catch (err) {
    if (err instanceof IdentityCrossTenantError) {
      return { status: "rejected", reason: "cross_tenant" };
    }
    throw err;
  }

  if (!identity) {
    return { status: "rejected", reason: "not_found" };
  }

  if (identity.integrity.linkStatus === "cross_tenant_mismatch") {
    return { status: "rejected", reason: "cross_tenant" };
  }

  if (identity.integrity.linkStatus === "invalid") {
    return { status: "rejected", reason: "invalid" };
  }

  const bundle = await composeProfileFromIdentity(tid, identity, { canManage });
  return { status: "ok", profile: bundle.profile };
}

/**
 * Full load including presentation supplements for the legacy overview adapter.
 */
export async function loadStaffProfileHubBundle(
  input: LoadStaffProfileHubInput,
  options?: LoadStaffProfileHubOptions
): Promise<
  | { status: "ok"; bundle: StaffProfileHubLoadBundle }
  | { status: "rejected"; reason: import("@/src/lib/team/profile/types").StaffProfileHubRejectionReason }
> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const canManage = options?.canManage ?? false;
  const throwOnCrossTenant = options?.throwOnCrossTenant !== false;

  let identity: StaffIdentity | null;
  try {
    identity = await resolveStaffIdentity(
      input.by === "staffId"
        ? { tenantId: tid, by: "staffId", staffId: assertNonEmptyUuid(input.staffId, "staffId") }
        : {
            tenantId: tid,
            by: "staffMemberId",
            staffMemberId: assertNonEmptyUuid(input.staffMemberId, "staffMemberId"),
          },
      { throwOnCrossTenant }
    );
  } catch (err) {
    if (err instanceof IdentityCrossTenantError) {
      return { status: "rejected", reason: "cross_tenant" };
    }
    throw err;
  }

  if (!identity) {
    return { status: "rejected", reason: "not_found" };
  }

  if (identity.integrity.linkStatus === "cross_tenant_mismatch") {
    return { status: "rejected", reason: "cross_tenant" };
  }

  if (identity.integrity.linkStatus === "invalid") {
    return { status: "rejected", reason: "invalid" };
  }

  const bundle = await composeProfileFromIdentity(tid, identity, { canManage });
  return { status: "ok", bundle };
}

async function composeProfileFromIdentity(
  tenantId: string,
  identity: StaffIdentity,
  options: { canManage: boolean }
): Promise<StaffProfileHubLoadBundle> {
  const staffMemberId = identity.staffMemberId?.trim() || null;
  const staffId = identity.staffId?.trim() || null;

  const accessPromise =
    staffMemberId != null
      ? loadStaffAccessCentreRowForMember(tenantId, staffMemberId, { identity })
      : Promise.resolve(null);

  const checklistPromise =
    staffMemberId != null
      ? loadOnboardingChecklist(tenantId, staffMemberId)
      : Promise.resolve(null);

  const onboardingInvitePromise =
    staffMemberId != null
      ? loadOnboardingInviteFacts(tenantId, staffMemberId)
      : Promise.resolve(null);

  const credentialsPromise =
    staffMemberId != null
      ? loadStaffCredentials(tenantId, staffMemberId)
      : Promise.resolve([]);

  const [accessRow, checklist, onboardingInvite, credentials] = await Promise.all([
    accessPromise,
    checklistPromise,
    onboardingInvitePromise,
    credentialsPromise,
  ]);

  let workforceIntelligence: StaffWorkforceIntelligence | null = null;
  let leaveContext: StaffProfileLeaveContext | null = null;

  if (mayUseSchedulingProjection(identity) && staffId) {
    try {
      const fiStaff = await loadStaffMemberForTenant(tenantId, staffId);
      if (fiStaff) {
        const [hrByStaffId, leaveData] = await Promise.all([
          loadHrNotificationByStaffId(tenantId, [fiStaff.id]),
          loadStaffLeaveContext({ tenantId, fiStaffId: fiStaff.id }),
        ]);
        leaveContext = leaveData;
        const intel = await loadWorkforceCommandCentreIntelligence(tenantId, [fiStaff], hrByStaffId);
        workforceIntelligence = intel.perStaff[fiStaff.id] ?? null;
      }
    } catch {
      workforceIntelligence = null;
      leaveContext = null;
    }
  }

  const systemAccessRevoked = Boolean(accessRow?.systemAccessRevoked);

  const access =
    accessRow != null
      ? projectStaffAccessEntry(identity, {
          authLoginStatus: accessRow.authLoginStatus,
          inviteStatus: accessRow.inviteStatus,
          loginInviteId: null,
          loginInviteExpiresAt: accessRow.inviteExpiresAt,
          canSendInvite: accessRow.canSendInvite,
          canResendInvite: accessRow.canResendInvite,
          canSuspendAccess: accessRow.canSuspendAccess,
          canRevokeAccess: accessRow.canRevokeAccess,
        })
      : // Scheduling-only / no lifecycle: surface identity access band without inventing invites.
        projectStaffAccessEntry(identity, {
          authLoginStatus:
            identity.accessStatus === "login_active"
              ? "login_active"
              : identity.accessStatus === "invite_pending"
                ? "invite_pending"
                : identity.accessStatus === "suspended"
                  ? "suspended"
                  : identity.accessStatus === "revoked"
                    ? "revoked"
                    : "no_login",
          inviteStatus: "none",
          loginInviteId: null,
          loginInviteExpiresAt: null,
          canSendInvite: false,
          canResendInvite: false,
          canSuspendAccess: false,
          canRevokeAccess: false,
        });

  const onboarding =
    staffMemberId != null && checklist != null && onboardingInvite != null
      ? projectStaffOnboardingEntry(identity, {
          onboardingInviteId: onboardingInvite.id,
          onboardingInviteStatus: onboardingInvite.status,
          onboardingInviteExpiresAt: onboardingInvite.expiresAt,
          checklist,
          systemAccessRevoked,
          canSendInvite: canSendOnboardingInvite({
            email: identity.email,
            systemAccessRevoked,
            employmentStatus: identity.employmentStatus,
            inviteStatus: onboardingInvite.status,
          }),
          canResendInvite: canResendOnboardingInvite({
            email: identity.email,
            systemAccessRevoked,
            employmentStatus: identity.employmentStatus,
            inviteStatus: onboardingInvite.status,
          }),
          canCopyInviteLink: canCopyOnboardingInviteLink({
            inviteStatus: onboardingInvite.status,
            hasInviteUrl: onboardingInvite.hasInviteUrl,
          }),
          canCancelOnboarding: false,
        })
      : null;

  // Presentation score from command-centre intel is the existing roster-readiness signal
  // on the profile surface — not a new readiness engine. Identity readiness is fallback only.
  const domainEligible = workforceIntelligence
    ? (workforceIntelligence.readinessScore ?? 0) >= 70 ||
      Boolean(workforceIntelligence.surgeryReady)
    : identity.readinessStatus === "ready";

  // projectRosterStaffEntry returns null without staffId — no invented lifecycle-only roster.
  const roster = projectRosterStaffEntry(identity, {
    domainEligible,
    schedulingActive: Boolean(staffId),
  });

  const compliance =
    staffMemberId != null
      ? projectStaffComplianceEntry(identity, {
          credentials,
          certifications: [],
          canUpload: options.canManage,
          canVerify: options.canManage,
          canReject: options.canManage,
          canRequestReplacement: options.canManage,
        })
      : null;

  const profile = composeStaffProfileHubModel({
    identity,
    access,
    onboarding,
    roster,
    compliance,
    hrefs: {
      identityAudit: buildStaffIdentityAuditHref(tenantId),
      access: buildStaffAccessCentreHrefForTenant(tenantId),
      onboarding: buildOnboardingCentreHrefForTenant(tenantId),
      roster: buildWorkforceRosterHref(tenantId),
      compliance: `${buildOnboardingCentreHrefForTenant(tenantId)}#compliance`,
    },
  });

  return {
    profile,
    supplements: {
      accessRow,
      checklist,
      workforceIntelligence,
      leaveContext,
      systemAccessRevoked,
    },
  };
}
