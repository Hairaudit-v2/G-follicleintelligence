import "server-only";

import {
  assertCrmTenantWriteAllowed,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { buildSurgeryOsMutationContext } from "@/src/lib/surgeryOs/surgeryOsMutationAccess.server";
import { surgeryOsActionAllowed } from "@/src/lib/surgeryOs/surgeryOsPolicy";

export type ProcedureDayMutationActor = {
  actorFiUserId: string | null;
};

/**
 * Procedure Day live mutations — CRM write gate (incl. impersonation) + SurgeryOS clinical role.
 */
export async function assertProcedureDayMutationAllowed(
  tenantId: string,
  adminKey?: string | null,
  request?: Request
): Promise<ProcedureDayMutationActor> {
  const tid = tenantId.trim();
  await assertCrmTenantWriteAllowed({ tenantId: tid, adminKey: adminKey ?? undefined, request });

  const ctx = await buildSurgeryOsMutationContext(tid);
  if (!ctx.canAccess) {
    throw new Error("Procedure Day mutations require SurgeryOS access for this tenant.");
  }
  const allowed =
    ctx.viewerRole === "admin" ||
    ctx.viewerRole === "theatre_manager" ||
    ctx.viewerRole === "coordinator" ||
    surgeryOsActionAllowed(ctx, "log_event") ||
    surgeryOsActionAllowed(ctx, "add_extraction_count");
  if (!allowed) {
    throw new Error("Your role cannot perform Procedure Day live workflow actions.");
  }
  const actorFiUserId = await tryResolveFiUserIdForTenant(tid, request);
  return { actorFiUserId };
}