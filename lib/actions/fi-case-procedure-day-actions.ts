"use server";

import { revalidatePath } from "next/cache";
import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { procedureDayUpsertBodySchema } from "@/src/lib/cases/procedureDayTypes";
import { upsertProcedureDayForCase } from "@/src/lib/cases/procedureDayUpdate";
import { ZodError } from "zod";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function upsertCaseProcedureDayAction(
  tenantId: string,
  caseId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = procedureDayUpsertBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const { adminKey: _ak, ...patch } = parsed;
    void _ak;

    await upsertProcedureDayForCase({ tenantId, caseId, patch });

    const tid = tenantId.trim();
    const cid = caseId.trim();
    revalidatePath(`/fi-admin/${tid}/cases/${cid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
