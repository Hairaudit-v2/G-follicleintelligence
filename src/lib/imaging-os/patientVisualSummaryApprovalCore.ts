/**
 * ImagingOS Phase 7A — patient visual summary approval metadata (pure).
 */

import {
  PATIENT_VISUAL_SUMMARY_APPROVAL_STATUSES,
  PATIENT_VISUAL_SUMMARY_REPORT_TYPES,
  PATIENT_VISUAL_SUMMARY_VERSION,
  type PatientVisualSummaryApprovalRecord,
  type PatientVisualSummaryApprovalStatus,
  type PatientVisualSummaryReportType,
} from "./patientVisualSummaryReportTypes";

const REPORTS_KEY = "patient_visual_summary_reports" as const;

function isApprovalStatus(v: unknown): v is PatientVisualSummaryApprovalStatus {
  return (
    typeof v === "string" &&
    (PATIENT_VISUAL_SUMMARY_APPROVAL_STATUSES as readonly string[]).includes(v)
  );
}

function isReportType(v: unknown): v is PatientVisualSummaryReportType {
  return (
    typeof v === "string" &&
    (PATIENT_VISUAL_SUMMARY_REPORT_TYPES as readonly string[]).includes(v)
  );
}

export function readPatientVisualSummaryApproval(
  metadata: Record<string, unknown> | null | undefined,
  reportType: PatientVisualSummaryReportType
): PatientVisualSummaryApprovalRecord | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;

  const reports = metadata[REPORTS_KEY];
  if (reports && typeof reports === "object" && !Array.isArray(reports)) {
    const raw = (reports as Record<string, unknown>)[reportType];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return parseApprovalRecord(raw as Record<string, unknown>, reportType);
    }
  }

  const legacy = metadata.patient_visual_summary;
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    const m = legacy as Record<string, unknown>;
    if (m.report_type === reportType) {
      return parseApprovalRecord(m, reportType);
    }
  }

  return null;
}

function parseApprovalRecord(
  m: Record<string, unknown>,
  fallbackReportType: PatientVisualSummaryReportType
): PatientVisualSummaryApprovalRecord | null {
  const status = m.status;
  if (!isApprovalStatus(status)) return null;
  const reportType = isReportType(m.report_type) ? m.report_type : fallbackReportType;
  return {
    status,
    approved_by: typeof m.approved_by === "string" ? m.approved_by : null,
    approved_at: typeof m.approved_at === "string" ? m.approved_at : null,
    report_type: reportType,
    version: PATIENT_VISUAL_SUMMARY_VERSION,
    surgery_id: typeof m.surgery_id === "string" ? m.surgery_id : null,
    updated_at: typeof m.updated_at === "string" ? m.updated_at : null,
  };
}

export function defaultPatientVisualSummaryApproval(
  reportType: PatientVisualSummaryReportType,
  surgeryId?: string | null
): PatientVisualSummaryApprovalRecord {
  return {
    status: "draft",
    approved_by: null,
    approved_at: null,
    report_type: reportType,
    version: PATIENT_VISUAL_SUMMARY_VERSION,
    surgery_id: surgeryId ?? null,
    updated_at: null,
  };
}

export function mergePatientVisualSummaryApprovalMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  record: PatientVisualSummaryApprovalRecord
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? { ...existingMetadata }
      : {};
  const reportsRaw = base[REPORTS_KEY];
  const reports =
    reportsRaw && typeof reportsRaw === "object" && !Array.isArray(reportsRaw)
      ? { ...(reportsRaw as Record<string, unknown>) }
      : {};
  reports[record.report_type] = record;
  return { ...base, [REPORTS_KEY]: reports };
}

export function patientVisualSummaryPatientAccessAllowed(
  approval: PatientVisualSummaryApprovalRecord | null
): boolean {
  return approval?.status === "approved" || approval?.status === "exported";
}

export function buildApprovedPatientVisualSummaryRecord(input: {
  existing: PatientVisualSummaryApprovalRecord;
  approvedByUserId: string;
  approvedAt?: string;
}): PatientVisualSummaryApprovalRecord {
  return {
    ...input.existing,
    status: "approved",
    approved_by: input.approvedByUserId,
    approved_at: input.approvedAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function buildExportedPatientVisualSummaryRecord(
  existing: PatientVisualSummaryApprovalRecord
): PatientVisualSummaryApprovalRecord {
  return {
    ...existing,
    status: "exported",
    updated_at: new Date().toISOString(),
  };
}

export function buildDraftPatientVisualSummaryRecord(
  existing: PatientVisualSummaryApprovalRecord
): PatientVisualSummaryApprovalRecord {
  return {
    ...existing,
    status: "draft",
    approved_by: null,
    approved_at: null,
    updated_at: new Date().toISOString(),
  };
}