"use server";

import { revalidatePath } from "next/cache";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { getStaffPinClinicSessionIfValid } from "@/src/lib/staffPin/staffPinSession.server";
import {
  endBreakFromPinSession,
  managerAddBreakToPunch,
  managerCloseForgottenPunch,
  startBreakFromPinSession,
} from "@/src/lib/workforce/staffTimeClock.server";
import { isPayPeriodFrequency } from "@/src/lib/workforce/payPeriodCore";
import { saveWorkforceTimeClockPolicy } from "@/src/lib/workforce/staffTimeClockPolicy.server";
import type { WorkforceTimeClockPolicy } from "@/src/lib/workforce/staffTimeClockPolicyCore";
import { assertWorkforceHrManageAllowed } from "@/src/lib/workforce/workforceHrManageGate.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateTimeClockSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}`);
  revalidatePath(`/fi-admin/${tid}/workforce-os/payroll`);
  revalidatePath(`/fi-admin/${tid}/workforce-os`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
  revalidatePath(`/fi-admin/${tid}/staff-pin-login`);
}

export async function updateWorkforceTimeClockBreaksEnabledAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; breaksEnabled: boolean } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const breaksEnabled = Boolean((b as { breaksEnabled?: boolean }).breaksEnabled);
    const policy = await saveWorkforceTimeClockPolicy(tenantId, { breaksEnabled });
    revalidateTimeClockSurfaces(tenantId);
    return { ok: true, breaksEnabled: policy.breaksEnabled };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateWorkforceTimeClockPolicyAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const patch: Record<string, unknown> = {};
    if ("breaksEnabled" in b) patch.breaksEnabled = Boolean((b as { breaksEnabled?: boolean }).breaksEnabled);
    if ("autoCloseEnabled" in b) {
      patch.autoCloseEnabled = Boolean((b as { autoCloseEnabled?: boolean }).autoCloseEnabled);
    }
    const freq = String((b as { payPeriodFrequency?: string }).payPeriodFrequency ?? "").trim();
    if (freq && isPayPeriodFrequency(freq)) patch.payPeriodFrequency = freq;
    const anchor = String((b as { payPeriodAnchor?: string }).payPeriodAnchor ?? "").trim();
    if (anchor) patch.payPeriodAnchor = anchor;
    const hour = Number((b as { autoCloseLocalHour?: number }).autoCloseLocalHour);
    if (Number.isFinite(hour)) patch.autoCloseLocalHour = hour;

    await saveWorkforceTimeClockPolicy(tenantId, patch as Partial<WorkforceTimeClockPolicy>);
    revalidateTimeClockSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function staffPinStartBreakAction(
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await getStaffPinClinicSessionIfValid(tenantId.trim());
    if (!session) return { ok: false, error: "PIN session expired. Sign in again." };
    await startBreakFromPinSession({
      tenantId: session.tenantId,
      fiStaffId: session.staffId,
    });
    revalidateTimeClockSurfaces(session.tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function staffPinEndBreakAction(
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await getStaffPinClinicSessionIfValid(tenantId.trim());
    if (!session) return { ok: false, error: "PIN session expired. Sign in again." };
    await endBreakFromPinSession({
      tenantId: session.tenantId,
      fiStaffId: session.staffId,
    });
    revalidateTimeClockSurfaces(session.tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function managerCloseForgottenPunchAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; timesheetEntryId: string | null } | { ok: false; error: string }> {
  try {
    const actor = await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const punchId = String((b as { punchId?: string }).punchId ?? "").trim();
    const clockOutAt = String((b as { clockOutAt?: string }).clockOutAt ?? "").trim();
    const notes = String((b as { notes?: string }).notes ?? "").trim();
    if (!punchId) throw new Error("punchId is required.");

    const result = await managerCloseForgottenPunch({
      tenantId,
      punchId,
      clockOutAt,
      notes,
      managerFiUserId: actor.fiUserId,
    });
    revalidateTimeClockSurfaces(tenantId);
    return { ok: true, timesheetEntryId: result.timesheetEntryId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function managerAddBreakToPunchAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const punchId = String((b as { punchId?: string }).punchId ?? "").trim();
    const breakStartAt = String((b as { breakStartAt?: string }).breakStartAt ?? "").trim();
    const breakEndAt = String((b as { breakEndAt?: string }).breakEndAt ?? "").trim();
    const notes = String((b as { notes?: string }).notes ?? "").trim();
    if (!punchId) throw new Error("punchId is required.");

    await managerAddBreakToPunch({
      tenantId,
      punchId,
      breakStartAt,
      breakEndAt,
      notes,
      managerFiUserId: actor.fiUserId,
    });
    revalidateTimeClockSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}