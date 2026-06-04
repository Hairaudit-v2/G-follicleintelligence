"use server";

import { revalidatePath } from "next/cache";
import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { patientAdminPatchBodySchema } from "@/src/lib/patients/patientApiSchemas";
import { updatePatientAdminDetails } from "@/src/lib/patients/server";
import { ZodError } from "zod";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

/**
 * Updates non-clinical patient admin fields. Does not append CRM activity (no lead anchor for generic patient edits in Stage 4A).
 */
export async function updatePatientAdminDetailsAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = patientAdminPatchBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    await updatePatientAdminDetails({
      tenantId,
      patientId,
      patient_status: parsed.patient_status,
      admin_note: parsed.admin_note,
    });

    revalidatePath(`/fi-admin/${tenantId.trim()}/patients`);
    revalidatePath(`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
