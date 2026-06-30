import "server-only";

import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { getFiTenantMemberSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import { resolveReceptionOsViewerContext } from "@/src/lib/receptionOs/receptionOsAccess.server";
import {
  receptionTaskActionAllowed,
  type ReceptionTaskAction,
} from "@/src/lib/receptionOs/receptionTaskPolicy";

export async function assertReceptionTaskMutationAllowed(
  tenantId: string,
  action: ReceptionTaskAction,
  adminKey?: string | null
): Promise<{ actorFiUserId: string | null }> {
  const tid = tenantId.trim();
  await assertCrmTenantReadAllowed({
    tenantId: tid,
    adminKey: adminKey ?? undefined,
    request: undefined,
  });

  const viewer = await resolveReceptionOsViewerContext(tid);
  if (!viewer.canAccessReceptionOs) {
    throw new Error(
      "ReceptionOS access requires an active staff or CRM shell role for this tenant."
    );
  }
  if (!receptionTaskActionAllowed(viewer.receptionOsRole, action)) {
    throw new Error(`Action "${action}" is not permitted for your role.`);
  }

  const member = await getFiTenantMemberSessionIfAllowed(tid);
  return { actorFiUserId: member?.fiUserId ?? null };
}
