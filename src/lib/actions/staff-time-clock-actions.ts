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
import { assertWorkforceHrManageAllowed } from "@/src/lib/workforce/workforceHrManageGate.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateTimeClockSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/workforce-os/payroll`);
  revalidatePath(`/fi-admin/${tid}/workforce-os`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
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