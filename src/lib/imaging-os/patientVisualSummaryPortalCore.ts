/**
 * ImagingOS Phase 7B — patient portal visual summary sanitization (pure).
 */

import { patientVisualSummaryPatientAccessAllowed } from "./patientVisualSummaryApprovalCore";
import { patientVisualSummaryReportIsPatientSafe } from "./patientVisualSummaryReportCore";
import type { PatientVisualSummaryReport } from "./patientVisualSummaryReportTypes";

export const PATIENT_PORTAL_FORBIDDEN_REPORT_KEYS = [
  "approved_by",
  "approved_at",
  "updated_at",
  "surgery_id",
] as const;

export type PatientPortalVisualSummaryItem = {
  caseId: string;
  reportType: PatientVisualSummaryReport["reportType"];
  report: PatientVisualSummaryReport;
};

export function isReportVisibleInPatientPortal(
  report: PatientVisualSummaryReport
): boolean {
  return (
    patientVisualSummaryPatientAccessAllowed(report.approval) &&
    report.patientAccessAllowed &&
    patientVisualSummaryReportIsPatientSafe(report)
  );
}

/** Strip staff-only fields before patient portal render. */
export function sanitizeReportForPatientPortal(
  report: PatientVisualSummaryReport
): PatientVisualSummaryReport {
  return {
    ...report,
    graftDistributionZones: report.graftDistributionZones.map((z) => ({
      zoneId: z.zoneId,
      label: z.label,
      description: z.description,
      ...(z.graftCount != null ? { graftCount: z.graftCount } : {}),
      ...(z.densityRange ? { densityRange: z.densityRange } : {}),
      ...(z.graftTypeMix && Object.keys(z.graftTypeMix).length > 0
        ? { graftTypeMix: z.graftTypeMix }
        : {}),
    })),
    approval: {
      status: report.approval.status,
      approved_by: null,
      approved_at: report.approval.approved_at,
      report_type: report.approval.report_type,
      version: report.approval.version,
      surgery_id: null,
      updated_at: null,
    },
    patientAccessAllowed: true,
  };
}

export function redactForbiddenPortalFields(
  report: PatientVisualSummaryReport
): Record<string, unknown> {
  const json = JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
  const approval = json.approval;
  if (approval && typeof approval === "object" && !Array.isArray(approval)) {
    for (const key of PATIENT_PORTAL_FORBIDDEN_REPORT_KEYS) {
      delete (approval as Record<string, unknown>)[key];
    }
  }
  for (const zone of (json.graftDistributionZones as Array<Record<string, unknown>>) ?? []) {
    delete zone.notes;
  }
  return json;
}