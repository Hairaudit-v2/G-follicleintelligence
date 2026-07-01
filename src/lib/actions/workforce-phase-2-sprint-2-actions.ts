"use server";

import { revalidatePath } from "next/cache";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { isTimesheetApprovalAction } from "@/src/lib/workforce/timesheetApprovalCore";
import {
  bulkTransitionTimesheetEntries,
  bulkTransitionTimesheetsByStatus,
  createTimesheetEntry,
  transitionTimesheetEntry,
  upsertAwardLoadingPlaceholder,
  upsertWorkforceWageProfile,
} from "@/src/lib/workforce/wageProfile.server";
import {
  dollarsToCents,
  isTimesheetEntryType,
  isTimesheetStatus,
  isWageRateType,
  type TimesheetStatus,
} from "@/src/lib/workforce/wageProfileCore";
import { assertWorkforceHrManageAllowed } from "@/src/lib/workforce/workforceHrManageGate.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePayroll(tenantId: string): void {
  revalidatePath(`/fi-admin/${tenantId.trim()}/workforce-os/payroll`);
  revalidatePath(`/fi-admin/${tenantId.trim()}/workforce-os`);
}

export async function upsertWorkforceWageProfileAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; wageProfileId: string } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const staffMemberId = String((b as { staffMemberId?: string }).staffMemberId ?? "").trim();
    const rateType = String((b as { rateType?: string }).rateType ?? "").trim();
    if (!staffMemberId) throw new Error("staffMemberId is required.");
    if (!isWageRateType(rateType)) throw new Error("Invalid rate type.");

    const rateDollars = Number((b as { baseRateDollars?: number | string }).baseRateDollars);
    const baseRateCents =
      Number.isFinite(rateDollars) && rateDollars > 0
        ? dollarsToCents(rateDollars)
        : Number((b as { baseRateCents?: number }).baseRateCents);
    if (!Number.isFinite(baseRateCents) || baseRateCents <= 0) {
      throw new Error("baseRateDollars or baseRateCents must be positive.");
    }

    const loadingRaw = (b as { awardLoadingCodes?: string[] }).awardLoadingCodes;
    const awardLoadingCodes = Array.isArray(loadingRaw)
      ? loadingRaw.map((c) => String(c).trim()).filter(Boolean)
      : undefined;

    const row = await upsertWorkforceWageProfile({
      tenantId,
      staffMemberId,
      wageProfileId:
        String((b as { wageProfileId?: string }).wageProfileId ?? "").trim() || null,
      rateType,
      baseRateCents,
      currency: String((b as { currency?: string }).currency ?? "AUD").trim() || "AUD",
      awardCode: String((b as { awardCode?: string }).awardCode ?? "").trim() || null,
      awardLoadingCodes,
      effectiveFrom: String((b as { effectiveFrom?: string }).effectiveFrom ?? "").trim() || null,
      notes: String((b as { notes?: string }).notes ?? "").trim() || null,
    });
    revalidatePayroll(tenantId);
    return { ok: true, wageProfileId: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function upsertAwardLoadingPlaceholderAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; placeholderId: string } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const awardCode = String((b as { awardCode?: string }).awardCode ?? "").trim();
    const loadingCode = String((b as { loadingCode?: string }).loadingCode ?? "").trim();
    const displayName = String((b as { displayName?: string }).displayName ?? "").trim();
    const loadingMultiplier = Number((b as { loadingMultiplier?: number }).loadingMultiplier);
    if (!awardCode || !loadingCode || !displayName) {
      throw new Error("awardCode, loadingCode, and displayName are required.");
    }

    const row = await upsertAwardLoadingPlaceholder({
      tenantId,
      placeholderId:
        String((b as { placeholderId?: string }).placeholderId ?? "").trim() || null,
      awardCode,
      loadingCode,
      displayName,
      loadingMultiplier: Number.isFinite(loadingMultiplier) ? loadingMultiplier : 1,
      description: String((b as { description?: string }).description ?? "").trim() || null,
    });
    revalidatePayroll(tenantId);
    return { ok: true, placeholderId: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createTimesheetEntryAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; entryId: string } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const staffMemberId = String((b as { staffMemberId?: string }).staffMemberId ?? "").trim();
    const workDate = String((b as { workDate?: string }).workDate ?? "").trim();
    const minutesWorked = Number((b as { minutesWorked?: number }).minutesWorked);
    if (!staffMemberId || !workDate) throw new Error("staffMemberId and workDate are required.");
    if (!Number.isFinite(minutesWorked) || minutesWorked < 0) {
      throw new Error("minutesWorked must be a non-negative number.");
    }

    const entryTypeRaw = String((b as { entryType?: string }).entryType ?? "regular").trim();
    const entryType = isTimesheetEntryType(entryTypeRaw) ? entryTypeRaw : "regular";

    const row = await createTimesheetEntry({
      tenantId,
      staffMemberId,
      workDate,
      entryType,
      minutesWorked,
      shiftId: String((b as { shiftId?: string }).shiftId ?? "").trim() || null,
      notes: String((b as { notes?: string }).notes ?? "").trim() || null,
    });
    revalidatePayroll(tenantId);
    return { ok: true, entryId: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function transitionTimesheetEntryAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; status: TimesheetStatus } | { ok: false; error: string }> {
  try {
    const actor = await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const entryId = String((b as { entryId?: string }).entryId ?? "").trim();
    const actionRaw = String((b as { action?: string }).action ?? "").trim();
    if (!entryId) throw new Error("entryId is required.");
    if (!isTimesheetApprovalAction(actionRaw)) throw new Error("Invalid timesheet action.");

    const row = await transitionTimesheetEntry({
      tenantId,
      entryId,
      action: actionRaw,
      actorFiUserId: actor.fiUserId,
      voidReason: String((b as { voidReason?: string }).voidReason ?? "").trim() || null,
    });
    revalidatePayroll(tenantId);
    return { ok: true, status: row.status };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function bulkTransitionTimesheetEntriesAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; updated: number; skipped: number } | { ok: false; error: string }> {
  try {
    const actor = await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const actionRaw = String((b as { action?: string }).action ?? "").trim();
    if (!isTimesheetApprovalAction(actionRaw)) throw new Error("Invalid timesheet action.");

    const entryIdsRaw = (b as { entryIds?: string[] }).entryIds;
    const fromStatusRaw = String((b as { fromStatus?: string }).fromStatus ?? "").trim();

    let result: { updated: number; skipped: number };
    if (Array.isArray(entryIdsRaw) && entryIdsRaw.length > 0) {
      result = await bulkTransitionTimesheetEntries({
        tenantId,
        entryIds: entryIdsRaw.map((id) => String(id).trim()).filter(Boolean),
        action: actionRaw,
        actorFiUserId: actor.fiUserId,
        voidReason: String((b as { voidReason?: string }).voidReason ?? "").trim() || null,
      });
    } else if (fromStatusRaw && isTimesheetStatus(fromStatusRaw)) {
      result = await bulkTransitionTimesheetsByStatus({
        tenantId,
        fromStatus: fromStatusRaw,
        action: actionRaw,
        actorFiUserId: actor.fiUserId,
        voidReason: String((b as { voidReason?: string }).voidReason ?? "").trim() || null,
      });
    } else {
      throw new Error("entryIds or fromStatus is required.");
    }

    revalidatePayroll(tenantId);
    return { ok: true, updated: result.updated, skipped: result.skipped };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}