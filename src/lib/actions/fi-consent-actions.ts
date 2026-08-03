"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { recordStaffAssistedConsentSignature } from "@/src/lib/consents/consentRequirementResolver.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const staffAssistedSchema = z
  .object({
    tenantId: z.string().uuid(),
    patientId: z.string().uuid(),
    instanceId: z.string().uuid(),
    signedName: z.string().max(200).optional(),
    adminKey: z.string().optional(),
  })
  .strict();

/**
 * Sprint A interim: mark outstanding consent as staff-assisted signed.
 * Patient magic-link e-sign lands in Sprint B.
 */
export async function recordStaffAssistedConsentAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = staffAssistedSchema.parse(body);
    const tid = parsed.tenantId.trim();
    const pid = parsed.patientId.trim();

    await assertCrmTenantWriteAllowed({
      tenantId: tid,
      adminKey: parsed.adminKey,
      request: undefined,
    });

    const fiUserId = await tryResolveFiUserIdForTenant(tid, undefined);
    await recordStaffAssistedConsentSignature({
      tenantId: tid,
      patientId: pid,
      instanceId: parsed.instanceId.trim(),
      recordedByFiUserId: fiUserId,
      signedName: parsed.signedName,
    });

    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors[0]?.message ?? "Invalid input." };
    }
    return { ok: false, error: errMsg(e) };
  }
}
