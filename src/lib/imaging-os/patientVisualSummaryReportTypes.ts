/**
 * ImagingOS Phase 7A — patient-safe visual summary report types.
 */

export const PATIENT_VISUAL_SUMMARY_VERSION = "patient_visual_summary_v1" as const;

export const PATIENT_VISUAL_SUMMARY_REPORT_TYPES = [
  "surgery_post_op_summary",
  "hairaudit_visual_summary",
] as const;

export type PatientVisualSummaryReportType = (typeof PATIENT_VISUAL_SUMMARY_REPORT_TYPES)[number];

export const PATIENT_VISUAL_SUMMARY_APPROVAL_STATUSES = [
  "draft",
  "approved",
  "exported",
] as const;

export type PatientVisualSummaryApprovalStatus =
  (typeof PATIENT_VISUAL_SUMMARY_APPROVAL_STATUSES)[number];

export type PatientVisualSummaryApprovalRecord = {
  status: PatientVisualSummaryApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  report_type: PatientVisualSummaryReportType;
  version: typeof PATIENT_VISUAL_SUMMARY_VERSION;
  surgery_id?: string | null;
  updated_at?: string | null;
};

export const PATIENT_VISUAL_SUMMARY_DISCLAIMER =
  "For patient education and clinical team review. Not a guarantee of outcome." as const;

export const PATIENT_VISUAL_SUMMARY_NOT_RECORDED = "Not recorded" as const;

export type PatientVisualSummaryPhotoSlot =
  | "immediate_post_op"
  | "day_1_post_op"
  | "donor"
  | "recipient"
  | "graft_tray";

export type PatientVisualSummaryPhotoPanelItem = {
  slot: PatientVisualSummaryPhotoSlot;
  label: string;
  image_id: string | null;
  preview_signed_url: string | null;
  photo_date: string | null;
  status_message: string;
};

export type PatientVisualSummaryGraftTypeMix = {
  singles?: number;
  doubles?: number;
  triples?: number;
  multiHair?: number;
  fiveHair?: number;
};

export type PatientVisualSummaryRecipientZone = {
  zoneId: string;
  label: string;
  description: string;
  graftCount?: number;
  densityRange?: string;
  graftTypeMix?: PatientVisualSummaryGraftTypeMix;
  notes?: string;
};

export type PatientVisualSummaryDensityZone = {
  label: string;
  qualitativeLabel: string;
  graftsPerCm2?: number | null;
};

export type PatientVisualSummaryGraftTypeSummary = {
  singles: number | typeof PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
  doubles: number | typeof PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
  triples: number | typeof PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
  fourPlusHair: number | typeof PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
  fiveHair: number | typeof PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
};

export type PatientVisualSummaryTimelineMilestone = {
  month: number;
  label: string;
};

export type PatientVisualSummaryAuditSummary = {
  uploadedViews: string[];
  imageQualityStatus: string;
  clinicalReviewStatus: string;
  missingOrRetakeViews: string[];
  longitudinalComparisonAvailable: boolean;
  patientSafeSummary: string;
};

export type PatientVisualSummaryReportHeader = {
  patientDisplay: string;
  clinicName: string | null;
  procedureOrAuditDate: string | null;
  reportType: PatientVisualSummaryReportType;
  reportTypeLabel: string;
  generatedAt: string;
  disclaimer: typeof PATIENT_VISUAL_SUMMARY_DISCLAIMER;
};

export type PatientVisualSummaryReport = {
  version: typeof PATIENT_VISUAL_SUMMARY_VERSION;
  reportType: PatientVisualSummaryReportType;
  header: PatientVisualSummaryReportHeader;
  photoPanel: PatientVisualSummaryPhotoPanelItem[];
  graftDistributionZones: PatientVisualSummaryRecipientZone[];
  hairlinePrinciples: string[];
  graftTypeSummary: PatientVisualSummaryGraftTypeSummary;
  densityZones: PatientVisualSummaryDensityZone[];
  healingTimeline: PatientVisualSummaryTimelineMilestone[];
  timelineVariationNote: string;
  monitoringItems: string[];
  followUpPlan: string | null;
  auditSummary: PatientVisualSummaryAuditSummary | null;
  approval: PatientVisualSummaryApprovalRecord;
  patientAccessAllowed: boolean;
};

/** Optional staff-recorded report data stored in case/surgery metadata (no schema change). */
export type PatientVisualSummaryStaffRecord = {
  version?: typeof PATIENT_VISUAL_SUMMARY_VERSION;
  recipient_zones?: Array<{
    zone_id?: string;
    graft_count?: number;
    density_range?: string;
    graft_type_mix?: PatientVisualSummaryGraftTypeMix;
    notes?: string;
  }>;
  density_zones?: Array<{
    label?: string;
    qualitative_label?: string;
    grafts_per_cm2?: number;
  }>;
  hairline_principles?: string[];
  five_hair_grafts?: number;
  patient_safe_audit_summary?: string;
  follow_up_plan?: string;
};