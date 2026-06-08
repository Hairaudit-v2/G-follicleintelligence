export type PathologyTemplateId =
  | "hair_loss_investigation"
  | "female_hair_loss_investigation"
  | "hair_transplant_pre_op"
  | "trt_monitoring"
  | "custom_request";

export type PathologyRequestStatus = "saved" | "cancelled";

export type PathologyRequestRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  request_date: string;
  doctor_user_id: string | null;
  template_used: PathologyTemplateId;
  status: PathologyRequestStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PathologyRequestItemRow = {
  id: string;
  tenant_id: string;
  request_id: string;
  sort_order: number;
  test_code: string | null;
  test_label: string;
  created_at: string;
};
