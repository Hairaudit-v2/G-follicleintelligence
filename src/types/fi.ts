/**
 * Follicle Intelligence domain model.
 * Types are independent of UI and match job-tracking / pipeline conventions.
 */

// ─── Stage Enum (job-tracking style) ───────────────────────────────────────

export enum FiStage {
  INTAKE_STARTED = "intake_started",
  SIGNALS_READY = "signals_ready",
  MODEL_RUNNING = "model_running",
  AWAITING_AUDIT = "awaiting_audit",
  APPROVED = "approved",
  ISSUED = "issued",
}

export const FI_STAGE_ORDER: FiStage[] = [
  FiStage.INTAKE_STARTED,
  FiStage.SIGNALS_READY,
  FiStage.MODEL_RUNNING,
  FiStage.AWAITING_AUDIT,
  FiStage.APPROVED,
  FiStage.ISSUED,
];

// ─── Domain Types ────────────────────────────────────────────────────────────

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at?: string;
};

export type Partner = {
  id: string;
  tenant_id: string;
  name: string;
  reference_code: string;
  slug?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
};

export type Referral = {
  id: string;
  partner_id: string;
  case_id: string;
  referral_code: string;
  created_at: string;
};

export type Patient = {
  id: string;
  tenant_id: string;
  partner_id?: string;
  full_name: string;
  email: string;
  dob: string;
  sex: string;
  country?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
};

export type BloodMarker = {
  name: string;
  value: string | number | null;
  unit?: string;
  referenceRange?: string;
  flag?: "low" | "normal" | "high" | "critical";
};

export type BloodSignal = {
  id: string;
  tenant_id: string;
  case_id: string;
  payload: { markers: BloodMarker[] };
  confidence?: Record<string, number | string>;
  created_at: string;
};

export type ImageSignal = {
  id: string;
  tenant_id: string;
  case_id: string;
  payload: {
    filename: string;
    storage_path: string;
    signals?: Record<string, unknown>;
  };
  confidence?: Record<string, number | string>;
  created_at: string;
};

export type Signal = BloodSignal | ImageSignal;

export type ModelRun = {
  id: string;
  tenant_id: string;
  case_id: string;
  job_id?: string;
  status: "queued" | "running" | "failed" | "complete";
  stage?: string;
  attempts: number;
  locked_at?: string;
  last_error?: string;
  created_at: string;
  updated_at?: string;
};

export type Scorecard = {
  id: string;
  tenant_id: string;
  case_id: string;
  model_run_id?: string;
  domain_scores: Record<string, number>;
  overall_score?: number;
  risk_tier?: string;
  explainability?: Record<string, string[]>;
  created_at: string;
};

export type Report = {
  id: string;
  tenant_id: string;
  case_id: string;
  model_run_id?: string;
  version: number;
  report_json: Record<string, unknown>;
  status: "draft" | "changes_required" | "approved" | "released";
  storage_path?: string;
  created_at: string;
  approved_at?: string;
  released_at?: string;
  updated_at?: string;
};

export type AuditorReview = {
  id: string;
  tenant_id: string;
  report_id: string;
  case_id: string;
  author?: string;
  note?: string;
  status?: "changes_required" | "approved";
  created_at: string;
};

export type ClaimSafeDisclaimer = {
  text: string;
  version?: number;
  effective_from?: string;
};

export type Intake = {
  id: string;
  tenant_id: string;
  external_id?: string;
  full_name: string;
  email: string;
  dob: string;
  sex: string;
  country?: string;
  primary_concern?: string;
  metadata?: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at?: string;
};
