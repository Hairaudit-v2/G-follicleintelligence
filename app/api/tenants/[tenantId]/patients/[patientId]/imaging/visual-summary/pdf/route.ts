/**
 * GET …/imaging/visual-summary/pdf — patient-safe visual summary PDF (staff read).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";
import { loadPatientVisualSummaryReport } from "@/src/lib/imaging-os/patientVisualSummaryReportLoad.server";
import { renderPatientVisualSummaryPdfBytes } from "@/src/lib/imaging-os/patientVisualSummaryPdf.server";
import { markPatientVisualSummaryExported } from "@/src/lib/imaging-os/patientVisualSummaryReportMutations.server";
import {
  PATIENT_VISUAL_SUMMARY_REPORT_TYPES,
  type PatientVisualSummaryReportType,
} from "@/src/lib/imaging-os/patientVisualSummaryReportTypes";

export const dynamic = "force-dynamic";

function parseReportType(raw: string | null): PatientVisualSummaryReportType | null {
  const v = raw?.trim();
  if (!v) return "surgery_post_op_summary";
  return (PATIENT_VISUAL_SUMMARY_REPORT_TYPES as readonly string[]).includes(v)
    ? (v as PatientVisualSummaryReportType)
    : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string }> }
) {
  try {
    const { tenantId, patientId } = await params;
    if (!tenantId?.trim() || !patientId?.trim())
      return crmJsonError(400, "Missing route parameters.");

    const url = new URL(req.url);
    const reportType = parseReportType(url.searchParams.get("reportType"));
    if (!reportType) return crmJsonError(400, "Invalid reportType.");

    const caseId = url.searchParams.get("caseId")?.trim() || null;
    const surgeryId = url.searchParams.get("surgeryId")?.trim() || null;

    const adminKey = extractAdminKeyFromRequest(req, url.searchParams.get("adminKey"));
    await rejectStaffPinSessionForRestrictedMutation(tenantId.trim());
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const report = await loadPatientVisualSummaryReport({
      tenantId: tenantId.trim(),
      patientId: patientId.trim(),
      reportType,
      caseId,
      surgeryId,
    });

    const bytes = await renderPatientVisualSummaryPdfBytes(report);

    if (caseId && report.approval.status === "approved") {
      await markPatientVisualSummaryExported({
        tenantId: tenantId.trim(),
        caseId,
        reportType,
      });
    }

    const slug =
      reportType === "hairaudit_visual_summary" ? "hairaudit-summary" : "surgery-summary";

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}-${patientId.trim().slice(0, 8)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}