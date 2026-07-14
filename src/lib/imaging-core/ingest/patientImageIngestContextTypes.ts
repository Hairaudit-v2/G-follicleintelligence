/**
 * Discriminated patient image ingest contexts (Phase 1).
 * Replaces the flat god-object with source-specific shapes keyed by routing kind.
 */

import type { FiImageCaptureSource } from "@/src/lib/patientImages/fiImageAttributionTypes";

/** Common DB-bound fields shared across ingest, upload, and post-capture flows. */
export type PatientImageCaptureBase = {
  tenant_id?: string;
  patient_id: string;
  image_id: string;
  storage_bucket: string;
  storage_path: string;
  content_type?: string | null;
  size_bytes?: number | null;
  metadata?: Record<string, unknown>;
};

/** Extended capture record fields persisted on `fi_patient_images`. */
export type PatientImageCaptureRecord = PatientImageCaptureBase & {
  case_id?: string | null;
  fi_event_id?: string | null;
  fi_upload_id?: string | null;
};

/** Legacy flat input accepted by routes and dual-write callers (compatibility). */
export type FlatPatientImageIngestionContext = PatientImageCaptureRecord & {
  consultation_id?: string | null;
  form_instance_id?: string | null;
  booking_id?: string | null;
  capture_source?: string | null;
  upload_source?: string | null;
  image_category?: string | null;
  protocol_template_slug?: string | null;
  protocol_slot_slug?: string | null;
  follow_up_interval?: string | null;
  visit_type?: string | null;
  anatomical_region?: string | null;
  external_category?: string | null;
  legacy_upload_type?: string | null;
  captured_by_staff_id?: string | null;
  procedure_day_id?: string | null;
  hairaudit_image_type?: string | null;
  hli_document_kind?: string | null;
};

/** @deprecated Use {@link FlatPatientImageIngestionContext} or parsed discriminated contexts. */
export type PatientImageIngestionContext = FlatPatientImageIngestionContext;

export type PatientImageIngestContextKind =
  | "hairaudit"
  | "hli"
  | "iiohr"
  | "consultation_os"
  | "surgery_os"
  | "legacy_follow_up"
  | "patient_portal"
  | "imaging_os_wizard"
  | "vie_capture_wizard"
  | "generic_fi_os"
  | "unknown";

export type IngestContextValidationIssue = {
  field: string;
  message: string;
};

export type IngestContextValidationResult = {
  valid: boolean;
  issues: IngestContextValidationIssue[];
};

type IngestProtocolFields = {
  protocol_template_slug?: string | null;
  protocol_slot_slug?: string | null;
  follow_up_interval?: string | null;
  visit_type?: string | null;
};

type IngestAttributionFields = {
  image_category?: string | null;
  external_category?: string | null;
  anatomical_region?: string | null;
  captured_by_staff_id?: string | null;
};

export type ParsedPatientImageIngestContextBase = PatientImageCaptureRecord & {
  capture_source: FiImageCaptureSource;
  upload_source: string | null;
  image_category?: string | null;
  external_category?: string | null;
  protocol_template_slug?: string | null;
  protocol_slot_slug?: string | null;
  follow_up_interval?: string | null;
  visit_type?: string | null;
};

export type HairauditIngestContext = ParsedPatientImageIngestContextBase & {
  kind: "hairaudit";
  legacy_upload_type?: string | null;
  hairaudit_image_type?: string | null;
};

export type HliIngestContext = ParsedPatientImageIngestContextBase & {
  kind: "hli";
  legacy_upload_type?: string | null;
  hli_document_kind?: string | null;
};

export type IiohrIngestContext = ParsedPatientImageIngestContextBase & {
  kind: "iiohr";
  legacy_upload_type?: string | null;
  hairaudit_image_type?: string | null;
};

export type ConsultationOsIngestContext = ParsedPatientImageIngestContextBase &
  IngestAttributionFields & {
    kind: "consultation_os";
    consultation_id: string;
    form_instance_id?: string | null;
  };

export type SurgeryOsIngestContext = ParsedPatientImageIngestContextBase &
  IngestProtocolFields & {
    kind: "surgery_os";
    booking_id?: string | null;
    procedure_day_id?: string | null;
    captured_by_staff_id?: string | null;
  };

export type LegacyFollowUpIngestContext = ParsedPatientImageIngestContextBase &
  IngestProtocolFields & {
    kind: "legacy_follow_up";
    captured_by_staff_id?: string | null;
    /** Resolved from metadata — links image ingest to fi_follow_up_encounters. */
    follow_up_encounter_id?: string | null;
  };

export type PatientPortalIngestContext = ParsedPatientImageIngestContextBase &
  IngestProtocolFields & {
    kind: "patient_portal";
    image_category?: string | null;
    external_category?: string | null;
  };

export type ImagingOsWizardIngestContext = ParsedPatientImageIngestContextBase &
  IngestProtocolFields &
  IngestAttributionFields & {
    kind: "imaging_os_wizard";
    consultation_id?: string | null;
  };

export type VieCaptureWizardIngestContext = ParsedPatientImageIngestContextBase &
  IngestProtocolFields &
  IngestAttributionFields & {
    kind: "vie_capture_wizard";
    consultation_id?: string | null;
  };

export type GenericFiOsIngestContext = ParsedPatientImageIngestContextBase &
  IngestProtocolFields &
  IngestAttributionFields & {
    kind: "generic_fi_os";
    consultation_id?: string | null;
  };

export type UnknownIngestContext = ParsedPatientImageIngestContextBase &
  IngestProtocolFields &
  IngestAttributionFields & {
    kind: "unknown";
    consultation_id?: string | null;
  };

export type ParsedPatientImageIngestContext =
  | HairauditIngestContext
  | HliIngestContext
  | IiohrIngestContext
  | ConsultationOsIngestContext
  | SurgeryOsIngestContext
  | LegacyFollowUpIngestContext
  | PatientPortalIngestContext
  | ImagingOsWizardIngestContext
  | VieCaptureWizardIngestContext
  | GenericFiOsIngestContext
  | UnknownIngestContext;
