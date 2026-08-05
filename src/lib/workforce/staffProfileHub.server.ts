/**
 * Compatibility adapter for the legacy profile overview loader.
 * Canonical composition lives in `@/src/lib/team/profile` (FI-TEAM-COHESION-B1.6).
 * Do not maintain a parallel identity / readiness composition path here.
 */

import "server-only";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadStaffProfileHubBundle } from "@/src/lib/team/profile/server";
import { toStaffProfileOverviewModel } from "@/src/lib/team/profile";
import type { StaffMemberLifecycleRow } from "@/src/lib/team/identity/staffLifecycleTypes";
import { resolveStaffIdentityAuditAccess } from "@/src/lib/team/identity/staffIdentityAuditAccess.server";
import type { StaffProfileOverviewModel } from "@/src/lib/workforce/staffProfileHubCore";

export type StaffProfileHubOverviewData = StaffProfileOverviewModel;

/**
 * Aggregates cross-domain staff state for the WorkforceOS profile Overview tab.
 * Delegates identity resolution + domain composition to `loadStaffProfileHubBundle`.
 */
export async function loadStaffProfileHubOverview(
  tenantId: string,
  lifecycle: StaffMemberLifecycleRow,
  options?: { canManage?: boolean }
): Promise<StaffProfileHubOverviewData> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(lifecycle.id, "staffMemberId");
  const canManage = options?.canManage ?? false;

  const [result, identityAuditAccess] = await Promise.all([
    loadStaffProfileHubBundle(
      { tenantId: tid, by: "staffMemberId", staffMemberId },
      { canManage, throwOnCrossTenant: false }
    ),
    resolveStaffIdentityAuditAccess(tid),
  ]);

  if (result.status !== "ok") {
    // Preserve a safe empty-ish overview for rejected identities rather than inventing policy.
    return toStaffProfileOverviewModel({
      profile: {
        identity: {
          tenantId: tid,
          personKey: `sm:${staffMemberId}`,
          staffId: lifecycle.fi_staff_id,
          staffMemberId,
          userId: null,
          displayName: lifecycle.full_name,
          email: lifecycle.email,
          employmentStatus: lifecycle.employment_status as never,
          accessStatus: "unknown",
          readinessStatus: "unknown",
          archivedAt: lifecycle.archived_at,
          hrLinked: false,
          primaryClinicId: null,
          clinicIds: [],
          roles: [],
          capabilities: [],
          integrity: {
            linkStatus:
              result.reason === "cross_tenant"
                ? "cross_tenant_mismatch"
                : result.reason === "invalid"
                  ? "invalid"
                  : "invalid",
            hasSchedulingRecord: Boolean(lifecycle.fi_staff_id),
            hasLifecycleRecord: true,
            hasAuthIdentity: false,
            warnings: [],
          },
        },
        overview: {
          displayName: lifecycle.full_name,
          employmentStatus: lifecycle.employment_status as never,
          accessStatus: "unknown",
          onboardingStatus: null,
          readinessStatus: "unknown",
          primaryClinicId: null,
          clinicIds: [],
        },
        directory: null,
        access: null,
        onboarding: null,
        roster: null,
        compliance: null,
        attentionReasons: [],
        actions: {
          identity: {
            readOnly: true,
            canCreateSchedulingRecord: false,
            canRepairIdentityLink: false,
          },
        },
      },
      tenantId: tid,
      checklist: {
        accountCreated: false,
        pinChosen: false,
        permissionsAssigned: false,
        trainingPending: true,
      },
      systemAccessRevoked: true,
      viewerCanManageAccess: false,
      viewerCanManageOnboarding: false,
      viewerCanManageReadiness: false,
      viewerCanViewIdentityAudit: identityAuditAccess.allowed,
    });
  }

  const { profile, supplements } = result.bundle;
  const checklist = supplements.checklist ?? {
    accountCreated: true,
    pinChosen: false,
    permissionsAssigned: false,
    trainingPending: true,
  };

  return toStaffProfileOverviewModel({
    profile,
    tenantId: tid,
    checklist,
    pinStatus: supplements.accessRow?.pinStatus ?? null,
    loginInviteStatus: supplements.accessRow?.inviteStatus ?? null,
    canCopyLoginInviteLink: supplements.accessRow?.canCopyInviteLink ?? false,
    canResetPin: supplements.accessRow?.canResetPin ?? false,
    systemAccessRevoked: supplements.systemAccessRevoked,
    workforceIntelligence: supplements.workforceIntelligence,
    leaveContext: supplements.leaveContext,
    viewerCanManageAccess: canManage,
    viewerCanManageOnboarding: canManage,
    viewerCanManageReadiness: canManage,
    viewerCanViewIdentityAudit: identityAuditAccess.allowed,
  });
}
