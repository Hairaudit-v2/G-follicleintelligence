"use server";

import { revalidatePath } from "next/cache";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";
import { resolveWorkforceActorFiUserId } from "@/src/lib/workforce-os/resolveWorkforceActorFiUserId.server";
import { mapWorkforceFkMutationError } from "@/src/lib/workforce-os/workforceMutationErrorsCore";
import type { EvolvedStaffRecord } from "@/src/lib/workforce-os/iiohrStaffHrLinkReconciliationTypes";
import {
  approveStaffHrLink,
  loadHrReconciliationPageData,
  manuallyLinkStaffHrIdentity,
  removeStaffHrLink,
  runHrProjectionSyncForTenant,
} from "@/src/lib/workforce-os/hrReconciliation.server";
import {
  archiveStaffMember,
  changeStaffEmploymentStatus,
  loadStaffLifecycleForFiStaff,
  loadStaffMemberAuditTimeline,
  restoreStaffMember,
  updateStaffProfile,
} from "@/src/lib/workforce-os/staffLifecycle.server";
import { setStaffMaternityLeave } from "@/src/lib/workforce/staffLeaveWorkflow.server";
import type {
  EmploymentStatusChangeInput,
  StaffProfileEditInput,
} from "@/src/lib/workforce-os/staffLifecycleTypes";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) {
    return mapWorkforceFkMutationError(e.message) ?? e.message;
  }
  return "Request failed.";
}

function revalidateWorkforceOsPaths(tenantId: string, staffId?: string) {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/workforce-os`);
  revalidatePath(`/fi-admin/${tid}/staff`);
  revalidatePath(`/fi-admin/${tid}/hr-os`);
  revalidatePath(`/fi-admin/${tid}/workforce-os/roster`);
  revalidatePath(`/fi-admin/${tid}/workforce-os/roster/standard-hours`);
  if (staffId) {
    revalidatePath(`/fi-admin/${tid}/workforce-os/staff/${staffId}`);
    revalidatePath(`/fi-admin/${tid}/staff/${staffId}/twin`);
  }
  revalidatePath(`/fi-admin/${tid}/workforce-os/hr-reconciliation`);
}

async function assertHrLifecycleManageAllowed(tenantId: string): Promise<{ fiUserId: string }> {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) throw new CrmAccessError(403, access.access.message);
  if (!access.platformAdminPreview) {
    const role = access.userRole.trim().toLowerCase();
    if (!HR_OS_ROUTE_REQUIRED_ROLES.some((allowed) => allowed === role)) {
      throw new CrmAccessError(403, "Owner, admin, or HR manager role required.");
    }
  }
  const fiUserId = await resolveWorkforceActorFiUserId(tenantId);
  return { fiUserId };
}

export async function updateStaffProfileAction(
  tenantId: string,
  staffMemberId: string,
  patch: StaffProfileEditInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertHrLifecycleManageAllowed(tenantId);
    const row = await updateStaffProfile({
      tenantId,
      staffMemberId,
      patch,
      actorUserId: fiUserId,
    });
    revalidateWorkforceOsPaths(tenantId, row.fi_staff_id ?? undefined);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function changeStaffEmploymentStatusAction(
  tenantId: string,
  staffMemberId: string,
  change: EmploymentStatusChangeInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertHrLifecycleManageAllowed(tenantId);
    const row = await changeStaffEmploymentStatus({
      tenantId,
      staffMemberId,
      change,
      actorUserId: fiUserId,
    });
    revalidateWorkforceOsPaths(tenantId, row.fi_staff_id ?? undefined);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function archiveStaffAction(
  tenantId: string,
  staffMemberId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertHrLifecycleManageAllowed(tenantId);
    const row = await archiveStaffMember({
      tenantId,
      staffMemberId,
      actorUserId: fiUserId,
    });
    revalidateWorkforceOsPaths(tenantId, row.fi_staff_id ?? undefined);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function restoreStaffAction(
  tenantId: string,
  staffMemberId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertHrLifecycleManageAllowed(tenantId);
    const row = await restoreStaffMember({
      tenantId,
      staffMemberId,
      actorUserId: fiUserId,
    });
    revalidateWorkforceOsPaths(tenantId, row.fi_staff_id ?? undefined);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function approveStaffHrLinkAction(
  tenantId: string,
  staffMemberId: string,
  iiohrStaffRecordId: string,
  iiohrUserId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertHrLifecycleManageAllowed(tenantId);
    await approveStaffHrLink({
      tenantId,
      staffMemberId,
      iiohrStaffRecordId,
      iiohrUserId,
      actorUserId: fiUserId,
    });
    revalidateWorkforceOsPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function manuallyLinkStaffHrAction(
  tenantId: string,
  staffMemberId: string,
  iiohrStaffRecordId: string,
  iiohrUserId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertHrLifecycleManageAllowed(tenantId);
    await manuallyLinkStaffHrIdentity({
      tenantId,
      staffMemberId,
      iiohrStaffRecordId,
      iiohrUserId,
      actorUserId: fiUserId,
    });
    revalidateWorkforceOsPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function removeStaffHrLinkAction(
  tenantId: string,
  staffMemberId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertHrLifecycleManageAllowed(tenantId);
    await removeStaffHrLink({
      tenantId,
      staffMemberId,
      actorUserId: fiUserId,
    });
    revalidateWorkforceOsPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadStaffLifecyclePageAction(
  tenantId: string,
  fiStaffId: string
): Promise<
  | {
      ok: true;
      lifecycle: Awaited<ReturnType<typeof loadStaffLifecycleForFiStaff>>;
      audit: Awaited<ReturnType<typeof loadStaffMemberAuditTimeline>>;
    }
  | { ok: false; error: string }
> {
  try {
    assertNonEmptyUuid(tenantId, "tenantId");
    assertNonEmptyUuid(fiStaffId, "fiStaffId");
    const access = await resolveHrOsRouteAccess(tenantId.trim());
    if (!access.ok) throw new CrmAccessError(403, access.access.message);
    const lifecycle = await loadStaffLifecycleForFiStaff(tenantId, fiStaffId);
    const audit = await loadStaffMemberAuditTimeline(tenantId, lifecycle.id);
    return { ok: true, lifecycle, audit };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadHrReconciliationPageAction(
  tenantId: string,
  evolvedStaffRecords?: EvolvedStaffRecord[]
): Promise<
  | { ok: true; pageData: Awaited<ReturnType<typeof loadHrReconciliationPageData>> }
  | { ok: false; error: string }
> {
  try {
    await assertHrLifecycleManageAllowed(tenantId);
    const pageData = await loadHrReconciliationPageData({
      tenantId,
      ...(evolvedStaffRecords !== undefined ? { evolvedStaffRecords } : {}),
    });
    return { ok: true, pageData };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function runHrProjectionSyncAction(
  tenantId: string
): Promise<
  | {
      ok: true;
      syncedCount: number;
      syncedAt: string;
      health: Awaited<
        ReturnType<typeof import("@/src/lib/workforce-os/projectionHealth.server").loadTenantHrProjectionHealth>
      >;
    }
  | { ok: false; error: string }
> {
  try {
    await assertHrLifecycleManageAllowed(tenantId);
    const result = await runHrProjectionSyncForTenant(tenantId);
    revalidateWorkforceOsPaths(tenantId);
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export type SetStaffMaternityLeaveActionInput = {
  startDate: string;
  expectedReturnDate: string;
  notes?: string | null;
  keepLoginAccess: boolean;
  pauseRosterEligibility: boolean;
  pauseStandardHours: boolean;
};

export async function setStaffMaternityLeaveAction(
  tenantId: string,
  staffMemberId: string,
  input: SetStaffMaternityLeaveActionInput
): Promise<{ ok: true; blockId: string } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertHrLifecycleManageAllowed(tenantId);
    const result = await setStaffMaternityLeave({
      tenantId,
      staffMemberId,
      startDate: input.startDate,
      expectedReturnDate: input.expectedReturnDate,
      notes: input.notes,
      keepLoginAccess: input.keepLoginAccess,
      pauseRosterEligibility: input.pauseRosterEligibility ?? true,
      pauseStandardHours: input.pauseStandardHours ?? true,
      actorUserId: fiUserId,
    });
    revalidateWorkforceOsPaths(tenantId, result.fiStaffId ?? undefined);
    return { ok: true, blockId: result.blockId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
