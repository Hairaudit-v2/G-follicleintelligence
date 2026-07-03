import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";
import { loadHrNotificationByStaffId } from "@/src/lib/staff/staffHrNotificationLoader.server";
import { loadWorkforceCommandCentreIntelligence } from "@/src/lib/staff/workforceCommandCentre.server";
import type { StaffMemberLifecycleRow } from "@/src/lib/workforce-os/staffLifecycleTypes";
import { runStaffIdentityReadinessAuditForMember } from "@/src/lib/workforce-os/staffIdentityReadinessAudit.server";
import {
  mapOnboardingInviteDisplayStatus,
} from "@/src/lib/workforce/onboarding/onboardingCentreCore";
import { loadOnboardingChecklist } from "@/src/lib/workforce/onboarding/onboardingChecklist.server";
import {
  loadStaffAccessCentreRowForMember,
  type StaffAccessCentreRow,
} from "@/src/lib/workforce/staffAccessCentre.server";
import type { StaffIdentityReadinessAuditRow } from "@/src/lib/workforce-os/staffIdentityReadinessAudit.server";
import {
  buildStaffProfileOverviewModel,
  type StaffProfileAccessSnapshot,
  type StaffProfileIdentityAuditSnapshot,
  type StaffProfileOverviewModel,
} from "@/src/lib/workforce/staffProfileHubCore";

export type StaffProfileHubOverviewData = StaffProfileOverviewModel;

function mapAccessSnapshot(row: StaffAccessCentreRow | null | undefined): StaffProfileAccessSnapshot | null {
  if (!row) return null;
  return {
    authLoginStatus: row.authLoginStatus,
    inviteStatus: row.inviteStatus,
    pinStatus: row.pinStatus,
    canSendInvite: row.canSendInvite,
    canResendInvite: row.canResendInvite,
    canCopyInviteLink: row.canCopyInviteLink,
    canResetPin: row.canResetPin,
    canSuspendAccess: row.canSuspendAccess,
    canRevokeAccess: row.canRevokeAccess,
  };
}

function mapIdentityAuditSnapshot(
  row: StaffIdentityReadinessAuditRow | null | undefined
): StaffProfileIdentityAuditSnapshot | null {
  if (!row) return null;
  return {
    workspaceProfileStatus: row.workspaceProfileStatus,
    loginStatus: row.loginStatus,
    pinStatus: row.pinStatus,
    onboardingStatus: row.onboardingStatus,
    issues: row.issues,
  };
}

async function loadOnboardingInviteStatus(
  tenantId: string,
  staffMemberId: string
): Promise<{ status: ReturnType<typeof mapOnboardingInviteDisplayStatus>; hasInviteUrl: boolean }> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const mid = assertNonEmptyUuid(staffMemberId, "staffMemberId");
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_staff_onboarding_invitations")
    .select("status, expires_at, accepted_at, invite_token")
    .eq("tenant_id", tid)
    .eq("staff_member_id", mid)
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!data) {
    return { status: "none", hasInviteUrl: false };
  }

  const raw = data as {
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
  const hasInviteUrl =
    Boolean(token) && (status === "pending" || status === "expired");

  return { status, hasInviteUrl };
}

/**
 * Aggregates cross-domain staff state for the WorkforceOS profile Overview tab.
 */
export async function loadStaffProfileHubOverview(
  tenantId: string,
  lifecycle: StaffMemberLifecycleRow,
  options?: { canManage?: boolean }
): Promise<StaffProfileHubOverviewData> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const staffMemberId = lifecycle.id;
  const canManage = options?.canManage ?? false;

  const [accessRow, checklist, onboardingInvite, identityAuditRow] = await Promise.all([
    loadStaffAccessCentreRowForMember(tid, staffMemberId),
    loadOnboardingChecklist(tid, staffMemberId),
    loadOnboardingInviteStatus(tid, staffMemberId),
    runStaffIdentityReadinessAuditForMember(tid, staffMemberId),
  ]);

  let workforceIntelligence = null;
  if (lifecycle.fi_staff_id) {
    try {
      const fiStaff = await loadStaffMemberForTenant(tid, lifecycle.fi_staff_id);
      if (fiStaff) {
        const hrByStaffId = await loadHrNotificationByStaffId(tid, [fiStaff.id]);
        const intel = await loadWorkforceCommandCentreIntelligence(
          tid,
          [fiStaff],
          hrByStaffId
        );
        workforceIntelligence = intel.perStaff[fiStaff.id] ?? null;
      }
    } catch {
      workforceIntelligence = null;
    }
  }

  const systemAccessRevoked = Boolean(accessRow?.systemAccessRevoked);

  return buildStaffProfileOverviewModel({
    tenantId: tid,
    staffMemberId,
    employmentStatus: lifecycle.employment_status,
    archivedAt: lifecycle.archived_at,
    email: lifecycle.email,
    systemAccessRevoked,
    onboardingInviteStatus: onboardingInvite.status,
    hasOnboardingInviteUrl: onboardingInvite.hasInviteUrl,
    checklist,
    accessRow: mapAccessSnapshot(accessRow),
    workforceIntelligence,
    identityAuditRow: mapIdentityAuditSnapshot(identityAuditRow),
    pinStatus: accessRow?.pinStatus ?? null,
    viewerCanManageAccess: canManage,
    viewerCanManageOnboarding: canManage,
    viewerCanManageReadiness: canManage,
  });
}
