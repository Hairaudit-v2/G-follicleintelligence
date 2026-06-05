import type { ConsultationIndexRow } from "@/src/lib/consultations/consultationLoaders.server";
export type PatientClinicalScalesPeek = {
  norwood_scale?: string | null;
  ludwig_scale?: string | null;
};

export type PatientConsultationListItem = ConsultationIndexRow & {
  scalesSyncedToPatient: boolean;
};

export function consultationScalesSyncedToPatient(
  consultation: ConsultationIndexRow,
  clinical: PatientClinicalScalesPeek | null | undefined
): boolean {
  if (!clinical) return false;
  const medical = consultation.structured_data?.medical_hair_loss;
  if (!medical || typeof medical !== "object" || Array.isArray(medical)) return false;
  const m = medical as Record<string, unknown>;
  const nw = typeof m.norwood_scale === "string" ? m.norwood_scale.trim() : null;
  if (nw && clinical.norwood_scale?.trim() === nw) return true;
  const ld = typeof m.ludwig_scale === "string" ? m.ludwig_scale.trim() : null;
  if (ld && clinical.ludwig_scale?.trim() === ld) return true;
  return false;
}

export function mapPatientConsultationListItems(
  consultations: ConsultationIndexRow[],
  clinical: PatientClinicalScalesPeek | null | undefined
): PatientConsultationListItem[] {
  return consultations.map((c) => ({
    ...c,
    scalesSyncedToPatient: consultationScalesSyncedToPatient(c, clinical),
  }));
}
