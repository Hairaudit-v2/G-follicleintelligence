"use server";

import { revalidatePath } from "next/cache";
import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { patientImageArchiveBodySchema, patientImagePatchBodySchema } from "@/src/lib/patientImages/patientImageApiSchemas";
import { archivePatientImage, updatePatientImageDetails } from "@/src/lib/patientImages/patientImagesServer";
import { patientClinicalDetailsPatchBodySchema } from "@/src/lib/patients/clinicalDetailsApiSchemas";
import { patientAdminPatchBodySchema } from "@/src/lib/patients/patientApiSchemas";
import { updatePatientClinicalDetails } from "@/src/lib/patients/clinicalDetailsServer";
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

/**
 * Updates structured clinical summary fields. Does not write CRM activity (patient-native activity stream deferred).
 */
export async function updatePatientClinicalDetailsAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = patientClinicalDetailsPatchBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    await updatePatientClinicalDetails({
      tenantId,
      patientId,
      patch: parsed,
      request: undefined,
    });

    revalidatePath(`/fi-admin/${tenantId.trim()}/patients`);
    revalidatePath(`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Updates category, caption, taken_at, or metadata for an active patient image.
 * Does not write CRM activity (patient-native activity stream deferred; `changed_keys` returned for future logging).
 */
export async function updatePatientImageDetailsAction(
  tenantId: string,
  patientId: string,
  imageId: string,
  body: unknown
): Promise<{ ok: true; changed_keys: string[] } | { ok: false; error: string }> {
  try {
    const parsed = patientImagePatchBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const result = await updatePatientImageDetails({
      tenantId,
      patientId,
      imageId,
      patch: parsed,
      request: undefined,
    });

    revalidatePath(`/fi-admin/${tenantId.trim()}/patients`);
    revalidatePath(`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`);
    return { ok: true, changed_keys: result.changed_keys };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Archives a patient image (soft status). Does not write CRM activity (deferred).
 */
export async function archivePatientImageAction(
  tenantId: string,
  patientId: string,
  imageId: string,
  body: unknown
): Promise<{ ok: true; changed_keys: string[] } | { ok: false; error: string }> {
  try {
    const parsed = patientImageArchiveBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const result = await archivePatientImage({
      tenantId,
      patientId,
      imageId,
      archiveReason: parsed.archive_reason,
      request: undefined,
    });

    revalidatePath(`/fi-admin/${tenantId.trim()}/patients`);
    revalidatePath(`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`);
    return { ok: true, changed_keys: result.changed_keys };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
