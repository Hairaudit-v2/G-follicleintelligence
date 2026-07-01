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
  resolvePatientVisualSummaryShareSecret,
  verifyPatientVisualSummaryShareToken,
} from "./patientVisualSummaryShareTokenCore";

export type SharedVisualSummaryPdfResult =
  | { ok: true; bytes: Uint8Array; filename: string }
  | { ok: false; status: number; error: string };

function resolveCasePatientId(row: {
  patient_id?: string | null;
  foundation_patient_id?: string | null;
}): string | null {
  const legacy = row.patient_id != null ? String(row.patient_id).trim() : "";
  if (legacy) return legacy;
  const foundation =
    row.foundation_patient_id != null ? String(row.foundation_patient_id).trim() : "";
  return foundation || null;
}

export async function loadSharedPatientVisualSummaryPdf(input: {
  tenantId: string;
  token: string;
}): Promise<SharedVisualSummaryPdfResult> {
  const secret = resolvePatientVisualSummaryShareSecret();
  if (!secret) {
    return { ok: false, status: 503, error: "Share links are not configured." };
  }

  const tid = input.tenantId.trim();
  const payload = verifyPatientVisualSummaryShareToken(input.token, secret);
  if (!payload || payload.tenantId !== tid) {
    return { ok: false, status: 403, error: "Invalid or expired share link." };
  }

  const supabase = supabaseAdmin();
  const { data: caseRow, error } = await supabase
    .from("fi_cases")
    .select("patient_id, foundation_patient_id, metadata, tenant_id")
    .eq("id", payload.caseId)
    .eq("tenant_id", tid)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  if (!caseRow) return { ok: false, status: 404, error: "Case not found." };

  const casePatientId = resolveCasePatientId(caseRow as {
    patient_id?: string | null;
    foundation_patient_id?: string | null;
  });
  const metadata =
    caseRow.metadata && typeof caseRow.metadata === "object" && !Array.isArray(caseRow.metadata)
      ? (caseRow.metadata as Record<string, unknown>)
      : {};
  const approval = readPatientVisualSummaryApproval(metadata, payload.reportType);

  const access = evaluatePatientPortalPdfAccess({
    requestPatientId: payload.patientId,
    casePatientId,
    approval,
  });
  if (!access.allowed) {
    const message =
      access.reason === "draft"
        ? "This summary is not approved for download."
        : "Access denied.";
    return { ok: false, status: 403, error: message };
  }

  const report = await loadPatientVisualSummaryReport({
    tenantId: tid,
    patientId: payload.patientId,
    reportType: payload.reportType,
    caseId: payload.caseId,
    surgeryId: approval?.surgery_id ?? null,
    useInitials: false,
  });

  const sanitized = sanitizeReportForPatientPortal(report);
  const bytes = await renderPatientVisualSummaryPdfBytes(sanitized);

  return {
    ok: true,
    bytes,
    filename: buildPatientPortalPdfFilename({
      reportType: payload.reportType,
      caseId: payload.caseId,
    }),
  };
}