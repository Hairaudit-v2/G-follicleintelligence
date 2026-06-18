import "server-only";

import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { getFiTenantMemberSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import { resolveSurgeryOsViewerContext } from "@/src/lib/surgeryOs/surgeryOsAccess.server";
import {
  resolveSurgeryOsStaffRoleCategory,
  surgeryOsActionAllowed,
  surgeryOsNoteKindAllowed,
  surgeryOsTeamStatusUpdateAllowed,
  type SurgeryOsAction,
  type SurgeryOsMutationContext,
} from "@/src/lib/surgeryOs/surgeryOsPolicy";
import type { SurgeryOsNoteKind } from "@/src/lib/surgeryOs/surgeryOsBoardModel";

export async function buildSurgeryOsMutationContext(tenantId: string): Promise<SurgeryOsMutationContext & { canAccess: boolean }> {
  const tid = tenantId.trim();
  const viewer = await resolveSurgeryOsViewerContext(tid);
  const member = viewer.authUserId ? await getFiTenantMemberSessionIfAllowed(tid) : null;
  return {
    viewerRole: viewer.surgeryOsRole,
    staffRoleCategory: resolveSurgeryOsStaffRoleCategory(viewer.staffRole),
    actorFiUserId: member?.fiUserId ?? null,
    canAccess: viewer.canAccessSurgeryOs,
  };
}

export async function assertSurgeryOsMutationAllowed(
  tenantId: string,
  action: SurgeryOsAction,
  adminKey?: string | null,
): Promise<SurgeryOsMutationContext> {
  const tid = tenantId.trim();
  await assertCrmTenantReadAllowed({ tenantId: tid, adminKey: adminKey ?? undefined, request: undefined });

  const ctx = await buildSurgeryOsMutationContext(tid);
  if (!ctx.canAccess) {
    throw new Error("SurgeryOS access requires an active staff or CRM shell role for this tenant.");
  }
  if (!surgeryOsActionAllowed(ctx, action)) {
    throw new Error(`Action "${action}" is not permitted for your role.`);
  }

  return {
    viewerRole: ctx.viewerRole,
    staffRoleCategory: ctx.staffRoleCategory,
    actorFiUserId: ctx.actorFiUserId,
  };
}

export async function assertSurgeryOsNoteMutationAllowed(
  tenantId: string,
  noteKind: SurgeryOsNoteKind,
  adminKey?: string | null,
): Promise<SurgeryOsMutationContext> {
  const ctx = await assertSurgeryOsMutationAllowed(tenantId, "add_note", adminKey);
  if (!surgeryOsNoteKindAllowed(ctx, noteKind)) {
    throw new Error(`Note kind "${noteKind}" is not permitted for your role.`);
  }
  return ctx;
}

export async function assertSurgeryOsTeamStatusMutationAllowed(
  tenantId: string,
  assignmentFiUserId: string,
  adminKey?: string | null,
): Promise<SurgeryOsMutationContext> {
  const tid = tenantId.trim();
  await assertCrmTenantReadAllowed({ tenantId: tid, adminKey: adminKey ?? undefined, request: undefined });

  const ctx = await buildSurgeryOsMutationContext(tid);
  if (!ctx.canAccess) {
    throw new Error("SurgeryOS access requires an active staff or CRM shell role for this tenant.");
  }
  if (!surgeryOsTeamStatusUpdateAllowed(ctx, assignmentFiUserId)) {
    throw new Error("You may not update this team member's status.");
  }
  return ctx;
}
