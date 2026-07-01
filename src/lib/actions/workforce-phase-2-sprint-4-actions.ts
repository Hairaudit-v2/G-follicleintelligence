"use server";

import { revalidatePath } from "next/cache";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { applyRecommendedProcedureTeam } from "@/src/lib/workforce/procedureStaffingOptimizer.server";
import { assertWorkforceHrManageAllowed } from "@/src/lib/workforce/workforceHrManageGate.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateProcedureStaffing(tenantId: string): void {
  revalidatePath(`/fi-admin/${tenantId.trim()}/workforce-os/procedure-staffing`);
  revalidatePath(`/fi-admin/${tenantId.trim()}/workforce-os/shift-cost`);
  revalidatePath(`/fi-admin/${tenantId.trim()}/workforce-os`);
}

export async function applyRecommendedProcedureTeamAction(
  tenantId: string,
  surgeryId: string
): Promise<
  | { ok: true; assignedCount: number; skippedCount: number }
  | { ok: false; error: string }
> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    const result = await applyRecommendedProcedureTeam({
      tenantId,
      surgeryId,
      actingUserId: fiUserId,
    });
    revalidateProcedureStaffing(tenantId);
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}