export const MEDICATION_CATALOGUE_CATEGORIES = [
  "common_oral",
  "less_common_oral",
  "common_topical",
  "less_common_topical",
  "delivery_fees",
] as const;

export type MedicationCatalogueCategory = (typeof MEDICATION_CATALOGUE_CATEGORIES)[number];

export const MEDICATION_FORM_TYPES = ["capsule", "solution", "foam", "delivery"] as const;
export type MedicationFormType = (typeof MEDICATION_FORM_TYPES)[number];

export const PRESCRIPTION_STATUSES = [
  "draft",
  "signed",
  "sent_to_pharmacy",
  "dispensed",
  "posted",
  "cancelled",
] as const;

export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number];

export type FiMedicationCatalogueRow = {
  id: string;
  tenant_id: string;
  category: MedicationCatalogueCategory;
  medication_name: string;
  form_type: MedicationFormType;
  quantity_label: string;
  base_price: number;
  active: boolean;
  pharmacy_notes: string | null;
  requires_doctor_approval: boolean;
};

export type FiPatientPrescriptionRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  doctor_id: string;
  case_id: string | null;
  status: PrescriptionStatus;
  pharmacy_id: string | null;
  pharmacy_name: string | null;
  delivery_type: string | null;
  patient_shipping_address: string | null;
  clinical_notes: string | null;
  signed_at: string | null;
  sent_at: string | null;
  ready_for_pharmacy_at: string | null;
  created_by_fi_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FiPrescriptionItemRow = {
  id: string;
  tenant_id: string;
  prescription_id: string;
  catalogue_id: string | null;
  medication_name: string;
  form_type: MedicationFormType;
  quantity_label: string;
  dose_instructions: string;
  repeats_instructions: string | null;
  reorder_rule: string | null;
  sort_order: number;
  created_at: string;
};

export type FiPrescriptionStatusEventRow = {
  id: string;
  tenant_id: string;
  prescription_id: string;
  from_status: string | null;
  to_status: string;
  actor_fi_user_id: string | null;
  note: string | null;
  created_at: string;
};

export const MEDICATION_CATEGORY_LABELS: Record<MedicationCatalogueCategory, string> = {
  common_oral: "Common oral scripts",
  less_common_oral: "Less common oral scripts",
  common_topical: "Common topical scripts",
  less_common_topical: "Less common topical scripts",
  delivery_fees: "Delivery fees",
};

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  draft: "Draft",
  signed: "Signed",
  sent_to_pharmacy: "Sent to pharmacy",
  dispensed: "Dispensed",
  posted: "Posted",
  cancelled: "Cancelled",
};
