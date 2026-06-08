/**
 * Pure types for Stage 4D patient treatment timeline (read-only aggregation).
 */

export type PatientTimelineItemType =
  | "lead_created"
  | "lead_converted"
  | "crm_activity"
  | "booking_scheduled"
  | "booking_completed"
  | "booking_cancelled"
  | "case_created"
  | "clinical_details_updated"
  | "image_uploaded"
  | "image_archived"
  | "patient_admin_updated"
  | "other";

export type PatientTimelineSourceType =
  | "patient"
  | "lead"
  | "crm_activity"
  | "booking"
  | "case"
  | "clinical"
  | "image"
  | "system";

export type PatientTimelineItem = {
  id: string;
  occurred_at: string;
  item_type: PatientTimelineItemType;
  title: string;
  subtitle: string | null;
  source_type: PatientTimelineSourceType;
  source_id: string;
  severity: string | null;
  href: string | null;
  metadata_summary: string | null;
  /** When true, UI should avoid secondary previews (e.g. comms / messages). */
  is_sensitive: boolean;
};

export type PatientTimelineSortDirection = "newest_first" | "oldest_first";

export type PatientTimelineHrefContext = {
  tenantId: string;
};

/** Raw activity row shape used by the builder (no DB coupling). */
export type PatientTimelineActivityInput = {
  id: string;
  occurred_at: string;
  activity_kind: string;
  /** Ignored for display — titles may contain unsafe/custom text. */
  title: string | null;
  /** Nullable for patient-native CRM events (e.g. blood requests) with no lead anchor. */
  lead_id: string | null;
  case_id: string | null;
  patient_id: string | null;
  detail: Record<string, unknown>;
};

export type PatientTimelineLeadInput = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  converted_at: string | null;
  converted_case_id: string | null;
  current_stage_id: string | null;
  stageLabel: string | null;
};

export type PatientTimelineBookingInput = {
  id: string;
  booking_type: string;
  booking_status: string;
  title: string | null;
  start_at: string;
  lead_id: string | null;
  case_id: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
};

export type PatientTimelineCaseInput = {
  id: string;
  status: string;
  case_type: string | null;
  created_at: string;
  sourceLeadId: string | null;
};

export type PatientTimelineClinicalInput = {
  patient_id: string;
  created_at: string;
  updated_at: string;
  norwood_scale: string | null;
  ludwig_scale: string | null;
  hairline_pattern: string | null;
  primary_concern: string | null;
};

export type PatientTimelinePatientInput = {
  id: string;
  created_at: string;
  updated_at: string;
  patient_status: string;
};

export type PatientTimelineImageInput = {
  id: string;
  image_category: string;
  image_status: "active" | "archived";
  caption: string | null;
  created_at: string;
  archived_at: string | null;
};

/** Everything needed to build a timeline without additional I/O. */
export type PatientTimelineSourceBundle = {
  tenantId: string;
  foundationPatientId: string;
  patient: PatientTimelinePatientInput;
  leads: readonly PatientTimelineLeadInput[];
  cases: readonly PatientTimelineCaseInput[];
  bookings: readonly PatientTimelineBookingInput[];
  activity: readonly PatientTimelineActivityInput[];
  clinical: PatientTimelineClinicalInput | null;
  images: readonly PatientTimelineImageInput[];
};

export type PatientTimelineBuildOptions = {
  hrefContext: PatientTimelineHrefContext;
  /** Max items after sort, before offset pagination. Default 100. */
  limit?: number;
  offset?: number;
  sort?: PatientTimelineSortDirection;
};

export type PatientTimelineBuildResult = {
  items: PatientTimelineItem[];
  /** Total items produced before limit/offset. */
  totalBuilt: number;
  hasMore: boolean;
};
