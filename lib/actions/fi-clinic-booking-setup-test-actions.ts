"use server";

import { z, ZodError } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  runClinicBookingSetupTest,
} from "@/src/lib/clinicSetup/clinicBookingSetupTest.server";
import type { ClinicBookingSetupTestResult } from "@/src/lib/clinicSetup/clinicBookingSetupTestTypes";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const bodySchema = z
  .object({
    adminKey: z.string().optional(),
    clinicId: z.string().uuid(),
  })
  .strict();

/**
 * Read-only diagnostic: room + staff eligibility + next-slot search. Does not create bookings or mutate data.
 */
export async function runClinicBookingSetupTestAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; result: ClinicBookingSetupTestResult } | { ok: false; error: string }> {
  try {
    const parsed = bodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const result = await runClinicBookingSetupTest({
      tenantId: tenantId.trim(),
      clinicId: parsed.clinicId.trim(),
    });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
