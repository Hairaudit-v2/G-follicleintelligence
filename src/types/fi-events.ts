/**
 * Follicle Intelligence event ingestion types.
 * Shared type-only contracts for producers, validators, and handlers.
 */

export type FiSourceSystem = "hli" | "hairaudit" | "clinic";

export type FiEventType =
  | "hli.intake.submitted"
  | "hli.document.uploaded"
  | "hairaudit.case.submitted"
  | "hairaudit.images.uploaded"
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
