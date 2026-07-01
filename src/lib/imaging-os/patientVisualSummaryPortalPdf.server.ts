import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPatientVisualSummaryApproval } from "./patientVisualSummaryApprovalCore";
import {
  buildPatientPortalPdfFilename,
  evaluatePatientPortalPdfAccess,
} from "./patientVisualSummaryPortalPdfCore";
import { sanitizeReportForPatientPortal } from "./patientVisualSummaryPortalCore";
import { renderPatientVisualSummaryPdfBytes } from "./patientVisualSummaryPdf.server";
import { loadPatientVisualSummaryReport } from "./patientVisualSummaryReportLoad.server";
import {
  PATIENT_VISUAL_SUMMARY_REPORT_TYPES,
  type PatientVisualSummaryReportType,
} from "./patientVisualSummaryReportTypes";

export type PatientPortalPdfResult =
  | { ok: true; bytes: Uint8Array; filename: string }
  | { ok: false; status: number; error: string };

function parseReportType(raw: string | null): PatientVisualSummaryReportType | null {
  const v = raw?.trim();
  if (!v) return "surgery_post_op_summary";
  return (PATIENT_VISUAL_SUMMARY_REPORT_TYPES as readonly string[]).includes(v)
    ? (v as PatientVisualSummaryReportType)
    : null;
}

export async function loadPatientPortalVisualSummaryPdf(input: {
  tenantId: string;
  patientId: string;
  caseId: string;
  reportTypeRaw?: string | null;
}): Promise<PatientPortalPdfResult> {
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const caseId = input.caseId.trim();
  const reportType = parseReportType(input.reportTypeRaw ?? null);
  if (!reportType) {
    return { ok: false, status: 400, error: "Invalid report type." };
  }
  if (!tid || !pid || !caseId) {
    return { ok: false, status: 400, error: "Missing parameters." };
  }

  const supabase = supabaseAdmin();
  const { data: caseRow, error } = await supabase
    .from("fi_cases")
    .select("patient_id, metadata, tenant_id")
    .eq("id", caseId)
    .eq("tenant_id", tid)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  if (!caseRow) return { ok: false, status: 404, error: "Case not found." };

  const casePatientId =
    caseRow.patient_id != null ? String(caseRow.patient_id) : null;
  const metadata =
    caseRow.metadata && typeof caseRow.metadata === "object" && !Array.isArray(caseRow.metadata)
      ? (caseRow.metadata as Record<string, unknown>)
      : {};
  const approval = readPatientVisualSummaryApproval(metadata, reportType);

  const access = evaluatePatientPortalPdfAccess({
    requestPatientId: pid,
    casePatientId,
    approval,
  });
  if (!access.allowed) {
    const status = access.reason === "draft" ? 403 : 403;
    const message =
      access.reason === "wrong_patient"
        ? "Access denied."
        : access.reason === "draft"
          ? "This summary is not yet approved for download."
          : "Case not available.";
    return { ok: false, status, error: message };
  }

  const report = await loadPatientVisualSummaryReport({
    tenantId: tid,
    patientId: pid,
    reportType,
    caseId,
    surgeryId: approval?.surgery_id ?? null,
    useInitials: false,
  });

  const sanitized = sanitizeReportForPatientPortal(report);
  const bytes = await renderPatientVisualSummaryPdfBytes(sanitized);

  return {
    ok: true,
    bytes,
    filename: buildPatientPortalPdfFilename({ reportType, caseId }),
  };
}