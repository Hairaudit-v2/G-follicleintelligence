/**
 * Stage 5J: read-only case summary / print document model (no writes, no PDF pipeline).
 */

import type { CaseReadinessHealth } from "@/src/lib/cases/caseReadinessTypes";

export type CaseSummaryDocumentMeta = {
  tenantId: string;
  caseId: string;
  /** ISO timestamp when the document was assembled (server). */
  generatedAtIso: string;
};

export type CaseSummaryKeyValue = { label: string; value: string };

export type CaseSummaryLeadLine = {
  title: string;
  status: string;
  linkReasonLabel: string;
  leadDetailHref: string;
};

export type CaseSummaryFollowUpLine = {
  checkpointLabel: string;
  scheduled: string;
  completed: string;
  statusLabel: string;
  notes: string | null;
  linkedImages: number;
};

export type CaseSummaryTimelinePreviewLine = {
  occurredOn: string;
  title: string;
  status: string | null;
  sensitive: boolean;
};

export type CaseSummaryReadinessSectionLine = {
  title: string;
  health: CaseReadinessHealth;
  summary: string;
};

/** Serializable view model for the case summary / export page. */
export type CaseSummaryDocument = {
  meta: CaseSummaryDocumentMeta;
  caseSummary: CaseSummaryKeyValue[];
  linkedPatient: {
    linked: boolean;
    rows: CaseSummaryKeyValue[];
    patientProfileHref: string | null;
  };
  linkedLeads: { leads: CaseSummaryLeadLine[] };
  treatmentProfile: CaseSummaryKeyValue[];
  planningNotes: string | null;
  surgeryPlan: {
    present: boolean;
    rows: CaseSummaryKeyValue[];
    zones: string[];
    graftEstimate: string | null;
    surgicalPlanSummary: string | null;
  };
  procedureDay: {
    present: boolean;
    rows: CaseSummaryKeyValue[];
    completionSummary: string | null;
  };
  postOp: {
    present: boolean;
    rows: CaseSummaryKeyValue[];
  };
  followUpCheckpoints: CaseSummaryFollowUpLine[];
  linkedImageCount: number;
  patientSafeImagingExports: Array<{
    photoDate: string;
    viewLabel: string;
    sessionType: string;
    progressLabel: string;
    statusMessage: string;
  }>;
  timeline: {
    eventCount: number;
    preview: CaseSummaryTimelinePreviewLine[];
  };
  readiness: {
    overallPercent: number;
    requiredSatisfied: number;
    requiredTotal: number;
    nextRecommendedStep: string;
    sections: CaseSummaryReadinessSectionLine[];
  };
};
