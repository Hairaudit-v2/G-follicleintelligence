import type { VieSurgeryPhase } from "@/src/lib/vie/vieProtocolTypes";
import type { VieSurgeryComparisonStatus } from "@/src/lib/vie/vieComparisonTypes";
import type { VieOutcomeStatus } from "@/src/lib/vie/vieOutcomeTypes";

export type SurgeryOsVieOutcomeReadiness = {
  overall_score: number;
  confidence_band: "high" | "medium" | "low";
  audit_ready: boolean;
  clinical_review_recommended: boolean;
  surgical_healing: {
    score: number;
    status: VieOutcomeStatus;
    evidence_count: number;
  };
  donor_recovery: {
    score: number;
    status: VieOutcomeStatus;
    evidence_count: number;
  };
  documentation_readiness: {
    score: number;
    status: VieOutcomeStatus;
  };
};

export type SurgeryOsVieCaptureWarningKind =
  | "missing_donor_final_extraction"
  | "missing_graft_tray_overview"
  | "missing_graft_tray_close"
  | "missing_immediate_post_op"
  | "pending_low_quality"
  | "donor_alignment_inconsistent"
  | "immediate_post_op_alignment_inconsistent";

export type SurgeryOsVieCaptureWarning = {
  kind: SurgeryOsVieCaptureWarningKind;
  label: string;
  severity: "info" | "warning" | "critical";
  slotSlug?: string;
};

export type SurgeryOsVieEvidenceSlotStatus = "complete" | "partial" | "missing" | "pending_review";

export type SurgeryOsViePhaseCaptureStatus = {
  phase: VieSurgeryPhase;
  label: string;
  requiredTotal: number;
  acceptedCount: number;
  pendingReviewCount: number;
  latestQualityScore: number | null;
  nextRecommendedSlot: string | null;
  nextRecommendedSlotLabel: string | null;
};

export type SurgeryOsVieCaptureSummary = {
  surgeryId: string;
  patientId: string;
  patientLabel: string;
  caseId: string | null;
  bookingId: string | null;
  procedureDayId: string | null;
  sessionId: string | null;
  protocolSlug: "surgery_day";
  surgicalDocumentationPercent: number;
  donorDocumentationPercent: number;
  graftTrayStatus: SurgeryOsVieEvidenceSlotStatus;
  immediatePostOpStatus: SurgeryOsVieEvidenceSlotStatus;
  phases: SurgeryOsViePhaseCaptureStatus[];
  warnings: SurgeryOsVieCaptureWarning[];
  nextRecommendedSlot: string | null;
  nextRecommendedSlotLabel: string | null;
  comparisonStatus: VieSurgeryComparisonStatus;
  outcomeReadiness: SurgeryOsVieOutcomeReadiness | null;
};

export type VieSurgeryCaptureContext = {
  tenantId: string;
  patientId: string;
  caseId: string | null;
  bookingId: string | null;
  procedureDayId: string | null;
  surgeryId: string | null;
  protocolSlug: "surgery_day";
  captureSurface: "surgery_os";
};

export type VieSurgeryImageMetadata = {
  case_id: string | null;
  booking_id: string | null;
  procedure_day_id: string | null;
  surgery_phase: VieSurgeryPhase | null;
  protocol_slug: string;
  slot_slug: string;
  capture_surface: "surgery_os";
};
