"use server";

import { revalidatePath } from "next/cache";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { refreshWorkforcePlanningForWeek } from "@/src/lib/workforce/workforcePlanningEngine.server";
import { assertWorkforceHrManageAllowed } from "@/src/lib/workforce/workforceHrManageGate.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePlanning(tenantId: string): void {
  revalidatePath(`/fi-admin/${tenantId.trim()}/workforce-os/planning`);
  revalidatePath(`/fi-admin/${tenantId.trim()}/workforce-os`);
}

export async function refreshWorkforcePlanningAction(
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    await refreshWorkforcePlanningForWeek(tenantId);
    revalidatePlanning(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}