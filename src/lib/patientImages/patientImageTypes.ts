/** Row shape for `fi_patient_images` (application layer). */

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
  image_category: PatientImageCategory;
  image_status: PatientImageStatus;
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
