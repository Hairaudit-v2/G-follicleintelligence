import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";

/**
 * FI OS Stage 5 — clinical intelligence signal registry (read-only metadata).
 * Copy is neutral and non-diagnostic; loaders decide when a signal applies.
 */
export const FI_CLINICAL_INTELLIGENCE_SIGNAL_CATEGORIES = [
  "consultation",
  "pathology",
  "medication",
  "surgery",
  "imaging",
  "follow_up",
  "outcome",
  "audit",
  "patient_twin",
] as const;

export type FiClinicalIntelligenceSignalCategory =
  (typeof FI_CLINICAL_INTELLIGENCE_SIGNAL_CATEGORIES)[number];

export type FiClinicalIntelligenceSignalVisibilityBand = "clinician" | "manager" | "director";

/** Optional count thresholds for severity escalation (interpreted by helpers, not persisted). */
export type FiClinicalIntelligenceSeverityThresholds = {
  attentionAt: number;
  criticalAt: number;
};

export type FiClinicalIntelligenceSignalDefinition = {
  key: FiClinicalIntelligenceSignalKey;
  label: string;
  description: string;
  category: FiClinicalIntelligenceSignalCategory;
  /** When null, severity is contextual only (helpers use defaults). */
  severityThresholds: FiClinicalIntelligenceSeverityThresholds | null;
  /** Who typically benefits from seeing this signal first (UI hint; RBAC still applies). */
  visibility: Record<FiClinicalIntelligenceSignalVisibilityBand, boolean>;
  /** Workspace personas that align with this signal (layout hint only). */
  relatedWorkspaceProfiles: readonly FiWorkspaceProfileKey[];
  /** Owning product area for provenance / support. */
  sourceModule: string;
  recommendedNextStep: string;
};

export const FI_CLINICAL_INTELLIGENCE_SIGNAL_KEYS = [
  "consultation_completion_attention",
  "pathology_review_pending",
  "medication_review_pending",
  "surgery_readiness_attention",
  "procedure_day_incomplete",
  "graft_count_missing",
  "donor_area_missing",
  "implantation_method_missing",
  "post_op_pending",
  "follow_up_overdue",
  "imaging_baseline_missing",
  "imaging_follow_up_missing",
  "audit_review_pending",
  "outcome_data_missing",
  "satisfaction_low",
  "complication_attention",
  "treatment_response_unknown",
  "prp_follow_up_due",
  "exosome_follow_up_due",
  "donor_safety_attention",
  "density_outcome_attention",
  "patient_twin_integrity_attention",
] as const;

export type FiClinicalIntelligenceSignalKey = (typeof FI_CLINICAL_INTELLIGENCE_SIGNAL_KEYS)[number];

const V = {
  all: { clinician: true, manager: true, director: true } as const,
  clinical: { clinician: true, manager: true, director: true } as const,
  leadership: { clinician: false, manager: true, director: true } as const,
};

const clinicalProfiles = [
  "surgeon",
  "doctor",
  "nurse",
  "clinic_manager",
  "director",
] as const satisfies readonly FiWorkspaceProfileKey[];
const surgeryProfiles = [
  "surgeon",
  "doctor",
  "clinic_manager",
  "director",
] as const satisfies readonly FiWorkspaceProfileKey[];
const pathProfiles = [
  "doctor",
  "surgeon",
  "clinic_manager",
  "director",
] as const satisfies readonly FiWorkspaceProfileKey[];

export const FI_CLINICAL_INTELLIGENCE_SIGNALS = [
  {
    key: "consultation_completion_attention",
    label: "Consultation completion",
    description: "Consultation workspaces may need completion or sign-off before the next step.",
    category: "consultation",
    severityThresholds: { attentionAt: 1, criticalAt: 15 },
    visibility: V.all,
    relatedWorkspaceProfiles: ["consultant", "doctor", "clinic_manager", "director"],
    sourceModule: "ConsultationOS",
    recommendedNextStep:
      "Review open consultation workspaces and complete remaining sections when ready.",
  },
  {
    key: "pathology_review_pending",
    label: "Pathology review",
    description: "Pathology results may be awaiting formal review in the workspace.",
    category: "pathology",
    severityThresholds: { attentionAt: 1, criticalAt: 8 },
    visibility: V.clinical,
    relatedWorkspaceProfiles: pathProfiles,
    sourceModule: "DoctorOS",
    recommendedNextStep: "Review pathology results in the clinical workspace when you are able.",
  },
  {
    key: "medication_review_pending",
    label: "Medication review",
    description: "Therapy or reorder items may need a documented clinical review.",
    category: "medication",
    severityThresholds: { attentionAt: 1, criticalAt: 10 },
    visibility: V.clinical,
    relatedWorkspaceProfiles: clinicalProfiles,
    sourceModule: "MedicationOS",
    recommendedNextStep:
      "Open MedicationOS items that are awaiting review and document decisions as appropriate.",
  },
  {
    key: "surgery_readiness_attention",
    label: "Surgery readiness",
    description: "Upcoming surgery journeys may be missing planning, linkage, or checklist items.",
    category: "surgery",
    severityThresholds: { attentionAt: 1, criticalAt: 12 },
    visibility: V.all,
    relatedWorkspaceProfiles: surgeryProfiles,
    sourceModule: "SurgeryOS",
    recommendedNextStep: "Review surgery readiness blockers on the case or readiness board.",
  },
  {
    key: "procedure_day_incomplete",
    label: "Procedure day",
    description: "Procedure day capture may be incomplete for scheduled activity.",
    category: "surgery",
    severityThresholds: { attentionAt: 1, criticalAt: 6 },
    visibility: V.clinical,
    relatedWorkspaceProfiles: surgeryProfiles,
    sourceModule: "SurgeryOS",
    recommendedNextStep: "Complete or confirm procedure day fields that still need documentation.",
  },
  {
    key: "graft_count_missing",
    label: "Graft count",
    description: "Planned or actual graft counts may not be recorded where they support handover.",
    category: "surgery",
    severityThresholds: null,
    visibility: V.clinical,
    relatedWorkspaceProfiles: surgeryProfiles,
    sourceModule: "SurgeryOS",
    recommendedNextStep: "Add graft count details where they support team coordination.",
  },
  {
    key: "donor_area_missing",
    label: "Donor area",
    description: "Donor area documentation may be missing for traceability.",
    category: "surgery",
    severityThresholds: null,
    visibility: V.clinical,
    relatedWorkspaceProfiles: surgeryProfiles,
    sourceModule: "SurgeryOS",
    recommendedNextStep: "Capture donor area notes or selections that your clinic expects on file.",
  },
  {
    key: "implantation_method_missing",
    label: "Implantation method",
    description: "Implantation method may not be recorded for this episode.",
    category: "surgery",
    severityThresholds: null,
    visibility: V.clinical,
    relatedWorkspaceProfiles: surgeryProfiles,
    sourceModule: "SurgeryOS",
    recommendedNextStep:
      "Record implantation method details your team uses for continuity of care.",
  },
  {
    key: "post_op_pending",
    label: "Post-op documentation",
    description: "Post-operative documentation may still be in an early or pending state.",
    category: "follow_up",
    severityThresholds: { attentionAt: 1, criticalAt: 8 },
    visibility: V.clinical,
    relatedWorkspaceProfiles: clinicalProfiles,
    sourceModule: "SurgeryOS",
    recommendedNextStep:
      "Update post-operative documentation when follow-up milestones are reached.",
  },
  {
    key: "follow_up_overdue",
    label: "Follow-up timing",
    description: "A follow-up checkpoint may be past its scheduled window.",
    category: "follow_up",
    severityThresholds: { attentionAt: 1, criticalAt: 10 },
    visibility: V.all,
    relatedWorkspaceProfiles: clinicalProfiles,
    sourceModule: "SurgeryOS",
    recommendedNextStep: "Schedule or complete follow-up checkpoints that are due.",
  },
  {
    key: "imaging_baseline_missing",
    label: "Baseline imaging",
    description: "Baseline imaging may not yet be linked for longitudinal comparison.",
    category: "imaging",
    severityThresholds: { attentionAt: 1, criticalAt: 6 },
    visibility: V.clinical,
    relatedWorkspaceProfiles: clinicalProfiles,
    sourceModule: "ImagingOS",
    recommendedNextStep: "Capture or upload baseline imaging when your protocol expects it.",
  },
  {
    key: "imaging_follow_up_missing",
    label: "Follow-up imaging",
    description: "Follow-up imaging checkpoints may not be present yet.",
    category: "imaging",
    severityThresholds: { attentionAt: 1, criticalAt: 6 },
    visibility: V.clinical,
    relatedWorkspaceProfiles: clinicalProfiles,
    sourceModule: "ImagingOS",
    recommendedNextStep: "Plan follow-up imaging capture according to your clinic timeline.",
  },
  {
    key: "audit_review_pending",
    label: "Audit review",
    description: "Formal audit or HairAudit-linked artefacts may need review attention.",
    category: "audit",
    severityThresholds: { attentionAt: 1, criticalAt: 5 },
    visibility: V.leadership,
    relatedWorkspaceProfiles: ["director", "clinic_manager", "auditor"],
    sourceModule: "AuditOS",
    recommendedNextStep:
      "Review outstanding audit items in the compliance workspace when scheduled.",
  },
  {
    key: "outcome_data_missing",
    label: "Outcome data",
    description: "Structured outcome fields may be missing for completed milestones.",
    category: "outcome",
    severityThresholds: { attentionAt: 1, criticalAt: 12 },
    visibility: V.clinical,
    relatedWorkspaceProfiles: clinicalProfiles,
    sourceModule: "SurgeryOS",
    recommendedNextStep: "Add follow-up outcome data your clinic tracks for quality assurance.",
  },
  {
    key: "satisfaction_low",
    label: "Satisfaction signal",
    description:
      "Recorded satisfaction may be below the neutral band and merits a supportive review.",
    category: "outcome",
    severityThresholds: null,
    visibility: V.leadership,
    relatedWorkspaceProfiles: ["clinic_manager", "director", "doctor"],
    sourceModule: "SurgeryOS",
    recommendedNextStep: "Review satisfaction context with the care team in a supportive setting.",
  },
  {
    key: "complication_attention",
    label: "Complication notes",
    description:
      "Complication or incident notes may be present for awareness and governance review.",
    category: "outcome",
    severityThresholds: null,
    visibility: V.clinical,
    relatedWorkspaceProfiles: surgeryProfiles,
    sourceModule: "SurgeryOS",
    recommendedNextStep:
      "Review complication documentation with the clinical team using local protocols.",
  },
  {
    key: "treatment_response_unknown",
    label: "Treatment response",
    description: "Therapy response documentation may not yet reflect a clear documented status.",
    category: "outcome",
    severityThresholds: null,
    visibility: V.clinical,
    relatedWorkspaceProfiles: ["doctor", "surgeon", "clinic_manager"],
    sourceModule: "DoctorOS",
    recommendedNextStep: "Document treatment response observations using your clinic templates.",
  },
  {
    key: "prp_follow_up_due",
    label: "PRP follow-up",
    description: "PRP-related follow-up scheduling may need attention when services are in use.",
    category: "follow_up",
    severityThresholds: null,
    visibility: V.clinical,
    relatedWorkspaceProfiles: clinicalProfiles,
    sourceModule: "CalendarOS",
    recommendedNextStep: "Confirm PRP follow-up bookings or notes when your services include PRP.",
  },
  {
    key: "exosome_follow_up_due",
    label: "Exosome follow-up",
    description:
      "Exosome-related follow-up scheduling may need attention when services are in use.",
    category: "follow_up",
    severityThresholds: null,
    visibility: V.clinical,
    relatedWorkspaceProfiles: clinicalProfiles,
    sourceModule: "CalendarOS",
    recommendedNextStep:
      "Confirm exosome follow-up bookings or notes when your services include exosome care.",
  },
  {
    key: "donor_safety_attention",
    label: "Donor safety documentation",
    description: "Donor safety fields may need review against your internal checklist.",
    category: "surgery",
    severityThresholds: null,
    visibility: V.clinical,
    relatedWorkspaceProfiles: surgeryProfiles,
    sourceModule: "SurgeryOS",
    recommendedNextStep: "Review donor safety checklist items documented for the case.",
  },
  {
    key: "density_outcome_attention",
    label: "Density outcome capture",
    description:
      "Density-oriented outcome capture may be incomplete where your protocol expects it.",
    category: "outcome",
    severityThresholds: null,
    visibility: V.clinical,
    relatedWorkspaceProfiles: surgeryProfiles,
    sourceModule: "SurgeryOS",
    recommendedNextStep: "Complete density-related outcome fields your clinic uses for reporting.",
  },
  {
    key: "patient_twin_integrity_attention",
    label: "Patient Twin integrity",
    description: "The Patient Twin projection may have linkage or completeness gaps.",
    category: "patient_twin",
    severityThresholds: { attentionAt: 1, criticalAt: 6 },
    visibility: V.all,
    relatedWorkspaceProfiles: clinicalProfiles,
    sourceModule: "PatientTwin",
    recommendedNextStep: "Review Patient Twin warnings and recommended actions to improve linkage.",
  },
] as const satisfies readonly FiClinicalIntelligenceSignalDefinition[];

const byKey: Record<string, FiClinicalIntelligenceSignalDefinition> = {};
for (const s of FI_CLINICAL_INTELLIGENCE_SIGNALS) {
  byKey[s.key] = s;
}

export function getFiClinicalIntelligenceSignalDefinition(
  key: string
): FiClinicalIntelligenceSignalDefinition | undefined {
  return byKey[key];
}

export function isFiClinicalIntelligenceSignalKey(k: string): k is FiClinicalIntelligenceSignalKey {
  return (FI_CLINICAL_INTELLIGENCE_SIGNAL_KEYS as readonly string[]).includes(k);
}
