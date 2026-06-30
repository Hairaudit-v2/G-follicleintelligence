import "server-only";

import { patientClinicalDetailsPatchBodySchema } from "./clinicalDetailsApiSchemas";
import { updatePatientClinicalDetails } from "./clinicalDetailsServer";

const SYNC_KEYS = ["norwood_scale", "ludwig_scale", "hairline_pattern", "primary_concern"] as const;

function readMedicalHairLossSection(
  structuredData: Record<string, unknown>
): Record<string, unknown> | null {
  const raw = structuredData.medical_hair_loss;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/**
 * When a consultation draft includes `medical_hair_loss` keys and links a foundation patient,
 * mirror scale / concern fields onto `fi_patient_clinical_details` (same tenant + patient RLS path as other writes).
 */
export async function syncConsultationMedicalHairLossToPatientClinicalDetails(params: {
  tenantId: string;
  patientId: string | null;
  structuredData: Record<string, unknown>;
}): Promise<void> {
  const pid = params.patientId?.trim();
  if (!pid) return;

  const medical = readMedicalHairLossSection(params.structuredData);
  if (!medical) return;

  const patchRecord: Record<string, unknown> = {};
  for (const key of SYNC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(medical, key)) continue;
    const raw = medical[key];
    if (typeof raw === "string") {
      const t = raw.trim();
      patchRecord[key] = t === "" ? null : t;
    } else if (raw === null) {
      patchRecord[key] = null;
    }
  }

  if (Object.keys(patchRecord).length === 0) return;

  const parsed = patientClinicalDetailsPatchBodySchema.safeParse(patchRecord);
  if (!parsed.success) return;

  await updatePatientClinicalDetails({
    tenantId: params.tenantId.trim(),
    patientId: pid,
    patch: parsed.data,
    request: null,
  });
}
