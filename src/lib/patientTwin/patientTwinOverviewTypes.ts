/**
 * FI-DEMO-DAY-2A.4 — Patient Intelligence Overview model (read-only composition).
 * Companion to PatientTwinV1 — not a DB schema and not a parallel product route.
 */

import type { ShowcaseDemoPackage } from "@/src/lib/demo-day/showcaseJamesChenConstants";
import type { ShowcaseDetectionResult } from "./patientTwinShowcaseDetection";

/** Empty / availability states — must stay distinct in UI copy. */
export type OverviewAvailability =
  | "recorded"
  | "not_recorded"
  | "not_available"
  | "not_applicable"
  | "planned_future";

/** Evidence provenance for outcome milestones. */
export type OutcomeEvidenceKind =
  | "observed_clinical"
  | "projected_outcome"
  | "projected_fixture"
  | "future_dated_fixture";

/** Approved product architecture names for provenance chips only (not nav chrome). */
export const OVERVIEW_ALLOWED_SOURCE_SYSTEMS = [
  "FiOS",
  "HLI",
  "HairAudit",
  "IIOHR",
  "Patient App",
  "ImagingOS",
] as const;

export type OverviewAllowedSourceSystem = (typeof OVERVIEW_ALLOWED_SOURCE_SYSTEMS)[number];

export type OverviewDeepLinks = {
  patientProfileHref: string;
  paymentsHref: string;
  imagingHref: string;
  caseHref: string | null;
  surgeryPlanningHref: string | null;
  surgeryDayHref: string | null;
  auditHref: string | null;
};

export type OverviewPatientSummary = {
  displayName: string;
  ageYears: number | null;
  stagingLabel: string | null;
  lifecycleStage: string | null;
  clinicalStatusLabel: string;
  fixtureReadinessLabel: string | null;
  clinicDisplayName: string | null;
  packageContextLabel: string | null;
  showcase: ShowcaseDetectionResult;
  completenessScore: number;
  completenessBand: string;
};

export type OverviewBaselineSection = {
  availability: OverviewAvailability;
  consultationSummary: string | null;
  clinicalHistorySignals: string[];
  riskSignals: string[];
  photographCount: number;
  photographStatus: OverviewAvailability;
  hliTrichoscopyStatus: OverviewAvailability;
  hliTrichoscopyNote: string | null;
  norwoodLabel: string | null;
};

export type OverviewPlannedZoneSummary = {
  key: string;
  label: string;
  grafts: number | null;
  targetDensityPerCm2: number | null;
};

export type OverviewSurgicalPlanSection = {
  availability: OverviewAvailability;
  recommendationSummary: string | null;
  treatmentContext: string | null;
  hairlineStatus: OverviewAvailability;
  hairlineLabel: string | null;
  plannedZones: OverviewPlannedZoneSummary[];
  plannedGrafts: number | null;
  caseId: string | null;
  surgeryPlanningHref: string | null;
};

export type OverviewProcedureSection = {
  availability: OverviewAvailability;
  surgeryDate: string | null;
  surgeryStatus: string | null;
  technique: string | null;
  actualImplantedGrafts: number | null;
  actualExtractedGrafts: number | null;
  plannedGrafts: number | null;
  graftReconciliationLabel: string | null;
  graftsReconciledToPlan: boolean | null;
  transectionRatePercent: number | null;
  teamRoleCount: number;
  surgeryDayHref: string | null;
};

export type OverviewOutcomeMilestone = {
  checkpointKey: string;
  label: string;
  measurementDate: string | null;
  evidenceKind: OutcomeEvidenceKind;
  /** Staff-facing badge — never implies observed follow-up for future fixtures. */
  evidenceBadge: string;
  densityPercentOfTarget: number | null;
  satisfactionOutOf10: number | null;
  availability: OverviewAvailability;
};

export type OverviewOutcomesSection = {
  availability: OverviewAvailability;
  projectedOutcome: {
    availability: OverviewAvailability;
    status: string | null;
    graftTarget: number | null;
    label: string;
  };
  milestones: OverviewOutcomeMilestone[];
};

export type OverviewWorkforceMember = {
  displayName: string;
  role: string;
  competencyValidOnProcedureDate: boolean | null;
  competencyNote: string | null;
};

export type OverviewWorkforceSection = {
  availability: OverviewAvailability;
  members: OverviewWorkforceMember[];
  procedureDate: string | null;
};

export type OverviewInvoiceLine = {
  kind: string;
  title: string | null;
  status: string;
  totalCents: number;
  amountPaidCents: number;
  currency: string;
};

export type OverviewEconomicsSection = {
  availability: OverviewAvailability;
  currency: "AUD" | string;
  quoteCents: number | null;
  depositCents: number | null;
  balanceCents: number | null;
  paidTotalCents: number;
  invoiceCount: number;
  invoices: OverviewInvoiceLine[];
  reconciled: boolean | null;
  reconciliationNote: string | null;
  paymentsHref: string;
};

export type OverviewGovernanceEvent = {
  label: string;
  occurredAt: string | null;
  kind: string;
};

export type OverviewGovernanceSection = {
  availability: OverviewAvailability;
  consentEvents: OverviewGovernanceEvent[];
  approvalEvents: OverviewGovernanceEvent[];
  auditSummary: string | null;
  sourceSystemsPresent: OverviewAllowedSourceSystem[];
  auditHref: string | null;
};

export type PatientIntelligenceOverviewModel = {
  tenantId: string;
  patientId: string;
  presentationMode: boolean;
  summary: OverviewPatientSummary;
  baseline: OverviewBaselineSection;
  surgicalPlan: OverviewSurgicalPlanSection;
  procedure: OverviewProcedureSection;
  outcomes: OverviewOutcomesSection;
  workforce: OverviewWorkforceSection;
  economics: OverviewEconomicsSection;
  governance: OverviewGovernanceSection;
  deepLinks: OverviewDeepLinks;
  /** Package isolation marker — never merge Package A/B rows. */
  demoPackage: ShowcaseDemoPackage | null;
};

export const OVERVIEW_SECTION_IDS = {
  summary: "overview-summary",
  baseline: "overview-baseline",
  surgicalPlan: "overview-surgical-plan",
  procedure: "overview-procedure",
  outcomes: "overview-outcomes",
  workforce: "overview-workforce",
  economics: "overview-economics",
  governance: "overview-governance",
} as const;
