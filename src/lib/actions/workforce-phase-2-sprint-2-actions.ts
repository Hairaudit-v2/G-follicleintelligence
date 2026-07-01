"use server";

import { revalidatePath } from "next/cache";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  createTimesheetEntry,
  upsertAwardLoadingPlaceholder,
  upsertWorkforceWageProfile,
} from "@/src/lib/workforce/wageProfile.server";
import {
  dollarsToCents,
  isTimesheetEntryType,
  isWageRateType,
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