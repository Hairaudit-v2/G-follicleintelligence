"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { assertCrmTenantStaffManageAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { bulkLinkStaffToFiUsers } from "@/src/lib/staff/staffFiUserLink.server";

const bulkLinkBodySchema = z
  .object({
    adminKey: z.string().optional(),
    staffIds: z.array(z.string().uuid()).min(1),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function bulkLinkStaffToFiUsersAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; linkedCount: number; createdUsers: number; unlinkedBefore: number; unlinkedAfter: number }
  | { ok: false; error: string }
> {
  try {
    const parsed = bulkLinkBodySchema.parse(body);
    await assertCrmTenantStaffManageAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const result = await bulkLinkStaffToFiUsers(tenantId.trim(), parsed.staffIds);
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/staff`);
    revalidatePath(`/fi-admin/${tid}/staff/link-users`);
    revalidatePath(`/fi-admin/${tid}/hr/staff-readiness`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
