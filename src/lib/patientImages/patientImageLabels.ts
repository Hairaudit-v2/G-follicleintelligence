import type { PatientImageCategory } from "./patientImageTypes";

export const PATIENT_IMAGE_CATEGORY_LABELS: Record<PatientImageCategory, string> = {
  consult: "Consult",
  scalp: "Scalp",
  donor: "Donor",
  hairline: "Hairline",
  trichoscopy: "Trichoscopy",
  post_op: "Post-op",
  progress: "Progress",
  before: "Before",
  after: "After",
  other: "Other",
};
