export const MEDICATION_REORDER_STATUSES = [
  "requested",
  "doctor_review_required",
  "approved",
  "sent_to_pharmacy",
  "posted",
  "completed",
  "rejected",
] as const;

export type MedicationReorderStatus = (typeof MEDICATION_REORDER_STATUSES)[number];

export const MEDICATION_REORDER_PAYMENT_STATUSES = ["not_required", "pending", "paid", "waived"] as const;

export type MedicationReorderPaymentStatus = (typeof MEDICATION_REORDER_PAYMENT_STATUSES)[number];

export const MEDICATION_REORDER_STATUS_LABELS: Record<MedicationReorderStatus, string> = {
  requested: "Requested",
  doctor_review_required: "Doctor review required",
  approved: "Approved",
  sent_to_pharmacy: "Sent to pharmacy",
  posted: "Posted",
  completed: "Completed",
  rejected: "Rejected",
};

export type FiMedicationReorderRequestRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  source_prescription_id: string;
  source_prescription_item_id: string;
  delivery_address: string;
  status: MedicationReorderStatus;
  fee_pence: number | null;
  payment_status: MedicationReorderPaymentStatus;
  doctor_review_crm_task_id: string | null;
  rejection_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
