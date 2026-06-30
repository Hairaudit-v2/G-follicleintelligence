"use server";

import { revalidatePath } from "next/cache";
import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  followUpDeleteBodySchema,
  followUpUpsertBodySchema,
  postOpTrackingUpsertBodySchema,
} from "@/src/lib/cases/postOpTypes";
import {
  deleteFollowUpForCase,
  upsertFollowUpForCase,
  upsertPostOpTrackingForCase,
} from "@/src/lib/cases/postOpUpdate";
import { ZodError } from "zod";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function upsertCasePostOpTrackingAction(
  tenantId: string,
  caseId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = postOpTrackingUpsertBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const { adminKey: _ak, ...patch } = parsed;
    void _ak;

    await upsertPostOpTrackingForCase({ tenantId, caseId, patch });

    const tid = tenantId.trim();
    const cid = caseId.trim();
    revalidatePath(`/fi-admin/${tid}/cases/${cid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function upsertCaseFollowUpAction(
  tenantId: string,
  caseId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = followUpUpsertBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const { adminKey: _ak, ...patch } = parsed;
    void _ak;

    await upsertFollowUpForCase({ tenantId, caseId, patch });

    const tid = tenantId.trim();
    const cid = caseId.trim();
    revalidatePath(`/fi-admin/${tid}/cases/${cid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function deleteCaseFollowUpAction(
  tenantId: string,
  caseId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = followUpDeleteBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    await deleteFollowUpForCase({ tenantId, caseId, followUpId: parsed.id });

    const tid = tenantId.trim();
    const cid = caseId.trim();
    revalidatePath(`/fi-admin/${tid}/cases/${cid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
