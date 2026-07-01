/**
 * Follicle Intelligence event ingestion types.
 * Shared type-only contracts for producers, validators, and handlers.
 */

export type FiSourceSystem = "hli" | "hairaudit" | "iiohr" | "clinic";

export type FiEventType =
  | "hli.intake.submitted"
  | "hli.document.uploaded"
  | "hairaudit.case.submitted"
  | "hairaudit.images.uploaded"
  | "iiohr.images.uploaded"
  | "clinic.ai.usage";

export type FiEventEnvelope = {
  tenant_id: string;
  event_type: FiEventType;
  source_system: FiSourceSystem;
  source_event_id: string;
  occurred_at?: string;
  identifiers?: {
    source_patient_id?: string;
    source_case_id?: string;
    source_clinic_id?: string;
    source_doctor_id?: string;
  };
  payload: Record<string, unknown>;
};

export type HliIntakeSubmittedPayload = {
  intake: {
    full_name: string;
    email: string;
    dob: string;
    sex: string;
    country?: string;
    primary_concern?: string;
    selections?: Record<string, unknown>;
    notes?: string;
  };
};

export type HliDocumentUploadedPayload = {
  document: {
    kind: string;
    filename: string;
    storage_path: string;
    mime_type?: string;
    size_bytes?: number;
  };
};

export type HairAuditCaseSubmittedPayload = {
  case: {
    patient_name?: string;
    email?: string;
    dob?: string;
    sex?: string;
    primary_concern?: string;
    country?: string;
    selections?: Record<string, unknown>;
    notes?: string;
  };
};

export type HairAuditImagesUploadedPayload = {
  images: Array<{
    type: string;
    filename: string;
    storage_path: string;
    mime_type?: string;
    size_bytes?: number;
  }>;
};

/** IIOHR academy case image upload (Phase 1 imaging consolidation). */
export type IiohrImagesUploadedPayload = {
  /** Academy case id (also accepted via identifiers.source_case_id). */
  academy_case_id: string;
  /** Foundation patient id when already resolved in FI OS. */
  patient_id?: string;
  /** External patient reference for global identity mapping. */
  patient_external_id?: string;
  professional_id?: string;
  global_professional_id?: string;
  /** Storage path preferred; image_url retained for producer compatibility. */
  storage_path?: string;
  image_url?: string;
  mime_type?: string;
  original_filename: string;
  canonical_view?: string;
  external_view?: string;
  uploaded_at?: string;
  size_bytes?: number;
  metadata?: Record<string, unknown>;
};
