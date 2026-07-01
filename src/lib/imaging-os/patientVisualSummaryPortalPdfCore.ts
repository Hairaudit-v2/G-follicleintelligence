/**
 * ImagingOS Phase 7C — patient portal PDF access rules (pure).
 */

import { patientVisualSummaryPatientAccessAllowed } from "./patientVisualSummaryApprovalCore";
import type { PatientVisualSummaryApprovalRecord } from "./patientVisualSummaryReportTypes";

export type PortalPdfAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "draft" | "wrong_patient" | "missing_case" | "invalid_params" };

export function evaluatePatientPortalPdfAccess(input: {
  requestPatientId: string;
  casePatientId: string | null | undefined;
  approval: PatientVisualSummaryApprovalRecord | null;
}): PortalPdfAccessDecision {
  const req = input.requestPatientId.trim();
  const casePatient = input.casePatientId?.trim() ?? "";
  if (!req || !casePatient) {
    return { allowed: false, reason: "missing_case" };
  }
  if (req !== casePatient) {
    return { allowed: false, reason: "wrong_patient" };
  }
  if (!input.approval || !patientVisualSummaryPatientAccessAllowed(input.approval)) {
    return { allowed: false, reason: "draft" };
  }
  return { allowed: true };
}

export function buildPatientPortalPdfFilename(input: {
  reportType: string;
  caseId: string;
}): string {
  const slug =
    input.reportType === "hairaudit_visual_summary" ? "hairaudit-summary" : "surgery-summary";
  return `${slug}-${input.caseId.slice(0, 8)}.pdf`;
}