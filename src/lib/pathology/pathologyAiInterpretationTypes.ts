import type { PathologyAiInterpretationJson } from "./pathologyAiInterpretationSchema";

export type PathologyAiInterpretationStatus = "draft" | "doctor_reviewed" | "archived";

export type PathologyAiInterpretationRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  pathology_result_id: string;
  status: PathologyAiInterpretationStatus;
  model_name: string | null;
  interpretation_json: PathologyAiInterpretationJson;
  doctor_summary: string | null;
  patient_friendly_summary: string | null;
  clinical_flags: unknown[];
  treatment_recommendations: unknown[];
  surgical_readiness_score: number | null;
  hair_loss_relevance_score: number | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
