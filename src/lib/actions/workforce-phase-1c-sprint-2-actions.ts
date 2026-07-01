"use server";

import { revalidatePath } from "next/cache";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { approveDuplicateCandidateForMerge, dismissDuplicateCandidate, keepDuplicateCandidatesSeparate } from "@/src/lib/workforce/duplicateReview.server";
import { manuallyLinkStaffIdentity } from "@/src/lib/workforce/staffReconciliationPage.server";
import { mergeStaffRecords } from "@/src/lib/workforce/staffMerge.server";
import { offboardStaffMember } from "@/src/lib/workforce/staffOffboarding.server";
import { assertWorkforceHrManageAllowed } from "@/src/lib/workforce/workforceHrManageGate.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateWorkforceHrSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  const paths = [
    `/fi-admin/${tid}/staff`,
    `/fi-admin/${tid}/hr-os`,
    `/fi-admin/${tid}/hr-os/sync-health`,
    `/fi-admin/${tid}/hr-os/staff-reconciliation`,
    `/fi-admin/${tid}/hr-os/duplicates`,
    `/fi-admin/${tid}/hr-os/offboarding`,
    `/fi-admin/${tid}/hr/sync-health`,
    `/fi-admin/${tid}/workforce-os`,
    `/fi-admin/${tid}/workforce-os/hr-reconciliation`,
  ];
  for (const p of paths) revalidatePath(p);
}

export async function manuallyLinkStaffIdentityAction(
  tenantId: string,
  staffMemberId: string,
  sourceSystem: string,
  externalId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    await manuallyLinkStaffIdentity({
      tenantId,
      staffMemberId,
      sourceSystem,
      externalId,
      linkedBy: fiUserId,
    });
    revalidateWorkforceHrSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function dismissDuplicateCandidateAction(
  tenantId: string,
  candidateId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    await dismissDuplicateCandidate(tenantId, candidateId, fiUserId);
    revalidateWorkforceHrSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function keepDuplicateSeparateAction(
  tenantId: string,
  candidateId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    await keepDuplicateCandidatesSeparate(tenantId, candidateId, fiUserId);
    revalidateWorkforceHrSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function approveDuplicateMergeAction(
  tenantId: string,
  candidateId: string,
  sourceStaffId: string,
  targetStaffId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    await approveDuplicateCandidateForMerge(tenantId, candidateId, fiUserId);
    await mergeStaffRecords({
      tenantId,
      sourceStaffId,
      targetStaffId,
      mergedBy: fiUserId,
    });
    revalidateWorkforceHrSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function mergeStaffRecordsAction(
  tenantId: string,
  sourceStaffId: string,
  targetStaffId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    await mergeStaffRecords({
      tenantId,
      sourceStaffId,
      targetStaffId,
      mergedBy: fiUserId,
    });
    revalidateWorkforceHrSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function offboardStaffMemberAction(
  tenantId: string,
  staffMemberId: string,
  exitReason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    await offboardStaffMember({
      tenantId,
      staffId: staffMemberId,
      exitReason,
      terminatedBy: fiUserId,
    });
    revalidateWorkforceHrSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}