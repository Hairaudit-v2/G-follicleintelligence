/** Row shape for `fi_patient_images` (application layer). */

import type {
  ImagingAnatomicalRegion,
  ImagingLibraryAxis,
} from "@/src/lib/imagingOs/imagingOsConstants";

export type PatientImageCategory =
  | "consult"
  | "scalp"
  | "donor"
  | "hairline"
  | "trichoscopy"
  | "post_op"
  | "progress"
  | "before"
  | "after"
  | "other";

export type PatientImageStatus = "active" | "archived";

export type PatientImageRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  person_id: string | null;
  case_id: string | null;
  booking_id: string | null;
  lead_id: string | null;
  consultation_id: string | null;
  form_instance_id: string | null;
  image_category: PatientImageCategory;
  image_status: PatientImageStatus;
  imaging_library_axis: ImagingLibraryAxis;
  clinic_id: string | null;
  captured_by_staff_id: string | null;
  device_type: string | null;
  anatomical_region: ImagingAnatomicalRegion | null;
  visit_type: string | null;
  follow_up_interval: string | null;
  imaging_protocol_template_slug: string | null;
  imaging_protocol_slot_slug: string | null;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  caption: string | null;
  taken_at: string | null;
  metadata: Record<string, unknown>;
  uploaded_by_user_id: string | null;
  archived_at: string | null;
  archived_by_user_id: string | null;
  archive_reason: string | null;
  created_at: string;
  updated_at: string;
  /** Stage 8A — Hair Image Intelligence (nullable until classified). */
  ai_image_category: string | null;
  ai_image_category_confidence: number | null;
  ai_hair_state: string | null;
  ai_shave_state: string | null;
  ai_surgery_stage: string | null;
  ai_image_ai_notes: string | null;
  ai_image_review_status: string;
  ai_image_reviewed_by_staff_id: string | null;
  ai_image_reviewed_at: string | null;
  ai_image_classified_at: string | null;
  ai_image_classifier_version: string | null;
};

/** Returned from loaders for active tiles that include a time-limited URL. */
export type PatientImageSignedDescriptor = {
  imageId: string;
  url: string;
  expiresAtIso: string;
};

export type PatientImageProfileTile = {
  image: PatientImageRow;
  signed: PatientImageSignedDescriptor;
};

export type PatientImagesProfileBundle = {
  counts: {
    total: number;
    active: number;
    archived: number;
  };
  /** Latest active images (max 50) with signed URLs for inline viewing. */
  activeWithSignedUrls: PatientImageProfileTile[];
  /** Archived metadata only — no signed URLs (Stage 4C default). */
  archived: PatientImageRow[];
};

export type CreatePatientImageUploadInput = {
  tenantId: string;
  patientId: string;
  file: File;
  imageCategory: unknown;
  caption?: string | null;
  takenAt?: string | null;
  metadata?: unknown;
  caseId?: string | null;
  bookingId?: string | null;
  leadId?: string | null;
  consultationId?: string | null;
  formInstanceId?: string | null;
  formFieldId?: string | null;
  imagingLibraryAxis?: unknown;
  clinicId?: string | null;
  capturedByStaffId?: string | null;
  deviceType?: string | null;
  anatomicalRegion?: unknown;
  visitType?: string | null;
  followUpInterval?: string | null;
  imagingProtocolTemplateSlug?: string | null;
  imagingProtocolSlotSlug?: string | null;
  actingUserId?: string | null;
  captureType?: unknown;
  captureSource?: unknown;
  imageWidth?: number | null;
  imageHeight?: number | null;
  protocolSessionId?: string | null;
};
