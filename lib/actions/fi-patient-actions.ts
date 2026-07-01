"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { getCrmShellSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import {
  loadPatientSlideOverPayload,
  type PatientSlideOverPayload,
} from "@/src/lib/patients/patientSlideOverLoader";
import {
  patientImageArchiveBodySchema,
  patientImagePatchBodySchema,
  patientImagePortalReleaseBodySchema,
} from "@/src/lib/patientImages/patientImageApiSchemas";
import {
  archivePatientImage,
  setPatientImagePortalReleaseStatus,
  updatePatientImageDetails,
} from "@/src/lib/patientImages/patientImagesServer";
import { patientClinicalDetailsPatchBodySchema } from "@/src/lib/patients/clinicalDetailsApiSchemas";
import { patientAdminPatchBodySchema } from "@/src/lib/patients/patientApiSchemas";
import { updatePatientClinicalDetails } from "@/src/lib/patients/clinicalDetailsServer";
import { updatePatientAdminDetails } from "@/src/lib/patients/server";
import { resolveOrCreatePerson } from "@/src/lib/fi/foundation/resolvePerson";
import { resolveOrCreatePatient } from "@/src/lib/fi/foundation/resolvePatient";
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
      reminder_consent: parsed.reminder_consent,
      preferred_contact_method: parsed.preferred_contact_method,
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
 * Releases or holds a patient image from the patient portal imaging view.
 */
export async function setPatientImagePortalReleaseAction(
  tenantId: string,
  patientId: string,
  imageId: string,
  body: unknown
): Promise<{ ok: true; changed_keys: string[] } | { ok: false; error: string }> {
  try {
    const parsed = patientImagePortalReleaseBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const result = await setPatientImagePortalReleaseStatus({
      tenantId,
      patientId,
      imageId,
      releaseStatus: parsed.release_status,
      request: undefined,
    });

    const tid = tenantId.trim();
    const pid = patientId.trim();
    revalidatePath(`/fi-admin/${tid}/patients`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    revalidatePath(`/patient/${tid}/imaging`);
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

const patientSlideOverLoadSchema = z.object({
  tenantId: z.string().min(1),
  patientId: z.string().min(1),
});

export async function loadPatientSlideOverBundleAction(
  tenantId: string,
  patientId: string
): Promise<{ ok: true; data: PatientSlideOverPayload } | { ok: false; error: string }> {
  try {
    const parsed = patientSlideOverLoadSchema.parse({ tenantId, patientId });
    const session = await getCrmShellSessionIfAllowed(parsed.tenantId);
    if (!session) return { ok: false, error: "Not authorised for this tenant workspace." };
    const data = await loadPatientSlideOverPayload(parsed.tenantId, parsed.patientId);
    if (!data) return { ok: false, error: "Patient not found." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const createDirectPatientBodySchema = z
  .object({
    adminKey: z.string().optional(),
    firstName: z.string().min(1, "First name is required.").max(120),
    lastName: z.string().min(1, "Last name is required.").max(120),
    mobile: z.string().min(6, "Mobile is required.").max(40),
    email: z.string().email("A valid email is required."),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD."),
  })
  .strict();

export type CreateDirectPatientResult =
  | { ok: true; patientId: string; personId: string; created: boolean }
  | { ok: false; error: string };

/**
 * Direct walk-in / admin patient registration — creates fi_person + fi_patient.
 */
export async function createDirectPatientAction(
  tenantId: string,
  body: unknown
): Promise<CreateDirectPatientResult> {
  try {
    const parsed = createDirectPatientBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const tid = tenantId.trim();
    const displayName = `${parsed.firstName.trim()} ${parsed.lastName.trim()}`.trim();

    const { person, created: personCreated } = await resolveOrCreatePerson(
      {
        tenant_id: tid,
        source_system: "fi_direct_patient_create",
        display_name: displayName,
        phone: parsed.mobile.trim(),
        email: parsed.email.trim(),
        date_of_birth: parsed.dateOfBirth.trim(),
        metadata: {
          first_name: parsed.firstName.trim(),
          last_name: parsed.lastName.trim(),
          surname: parsed.lastName.trim(),
        },
      },
      undefined
    );

    const { patient, created: patientCreated } = await resolveOrCreatePatient(
      {
        tenant_id: tid,
        person_id: person.id,
        source_system: "fi_direct_patient_create",
      },
      undefined
    );

    revalidatePath(`/fi-admin/${tid}/patients`);
    revalidatePath(`/fi-admin/${tid}/patients/${patient.id}`);
    return {
      ok: true,
      patientId: patient.id,
      personId: person.id,
      created: personCreated || patientCreated,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
