"use server";

import { z, ZodError } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { applyClinicBookingSetupAutoFix } from "@/src/lib/clinicSetup/clinicBookingSetupAutoFix.server";
import type { ClinicBookingSetupAutoFixResult } from "@/src/lib/clinicSetup/clinicBookingSetupAutoFixTypes";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const bodySchema = z
  .object({
    clinicId: z.string().uuid(),
    fixKeys: z.array(z.string().min(1)).min(1),
    confirmPerthAliases: z.boolean().optional(),
    adminKey: z.string().optional(),
  })
  .strict();

/**
 * Applies tagged, non-destructive booking-setup fixes (room/staff eligibility inserts, calendar flags, Perth aliases).
 */
export async function applyClinicBookingSetupAutoFixAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; outcome: ClinicBookingSetupAutoFixResult } | { ok: false; error: string }> {
  try {
    const parsed = bodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const outcome = await applyClinicBookingSetupAutoFix({
      tenantId: tenantId.trim(),
      clinicId: parsed.clinicId.trim(),
      fixKeys: parsed.fixKeys,
      confirmPerthAliases: parsed.confirmPerthAliases,
    });
    return { ok: true, outcome };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
