"use server";

import { revalidatePath } from "next/cache";

import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { markCrmQuoteAcceptedForTenant } from "@/src/lib/crm/crmQuoteMutations.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function markCrmQuoteAcceptedAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; result: Awaited<ReturnType<typeof markCrmQuoteAcceptedForTenant>> }
  | { ok: false; error: string }
> {
  try {
    const b =
      body && typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const adminKey = typeof b.adminKey === "string" ? b.adminKey : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: undefined });
    const quoteId = String(b.quoteId ?? "").trim();
    if (!quoteId) throw new Error("quoteId is required.");

    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await markCrmQuoteAcceptedForTenant({
      tenantId: tenantId.trim(),
      quoteId,
      actorFiUserId: fiUserId,
    });

    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}`);
    revalidatePath(`/fi-admin/${tid}/crm`);
    if (result.caseId?.trim()) {
      revalidatePath(`/fi-admin/${tid}/cases/${encodeURIComponent(result.caseId.trim())}`);
    }
    if (result.consultationId?.trim()) {
      revalidatePath(
        `/fi-admin/${tid}/consultations/${encodeURIComponent(result.consultationId.trim())}`
      );
    }
    if (result.leadId?.trim()) {
      revalidatePath(`/fi-admin/${tid}/crm/leads/${encodeURIComponent(result.leadId.trim())}`);
    }
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
